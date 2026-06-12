import dotenv from "dotenv";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createSerialManager } from "./serial.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const cloudApiUrl = (process.env.CLOUD_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const deviceApiKey = process.env.DEVICE_API_KEY || "";
const parkingCode = process.env.PARKING_CODE || "DINJPUR-PARKING-1";
const workerId = process.env.WORKER_ID || os.hostname();
const enableCommandPolling = process.env.ENABLE_COMMAND_POLLING !== "0";
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 5000);
const debugLogs = process.env.DEBUG_LOGS === "1";
let lastSlotValues = null;
let lastQueuedSlotValues = null;
let lastEntrySensorState = null;
let lastExitSensorState = null;
let isPollingCommands = false;

function debugLog(...args) {
  if (debugLogs) {
    console.log(...args);
  }
}

function sameSlotValues(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

async function requestJson(pathname, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  if (deviceApiKey) {
    headers["x-device-key"] = deviceApiKey;
  }

  const response = await fetch(`${cloudApiUrl}${pathname}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
}

function parseSlotValues(raw) {
  const parts = raw.split(",").map((value) => value.trim());
  if (parts.length !== 5) {
    return null;
  }

  const values = parts.map(Number);
  if (values.some((value) => Number.isNaN(value) || ![0, 1].includes(value))) {
    return null;
  }

  return values;
}

async function reportEntrySensor() {
  console.log("[pi] entry sensor event sent");
  await requestJson("/api/pi/events/entry", {
    method: "POST",
    body: JSON.stringify({ parkingCode }),
  });
  console.log("[pi] entry sensor reply received");
}

async function reportExitSensor() {
  console.log("[pi] exit sensor event sent");
  await requestJson("/api/pi/events/exit", {
    method: "POST",
    body: JSON.stringify({ parkingCode }),
  });
  console.log("[pi] exit sensor reply received");
}

async function reportGateSensorState(sensorName, currentState) {
  const sensor = sensorName === "ENTRY_SENSOR" ? "entry" : "exit";
  console.log(`[pi] ${sensor} sensor state sent: ${currentState}`);
  await requestJson("/api/pi/gate-sensors", {
    method: "PUT",
    body: JSON.stringify({ parkingCode, sensor, isActive: currentState === 1 }),
  });
  console.log(`[pi] ${sensor} sensor state reply received`);
}

function parseGateSensorState(line, sensorName) {
  const prefix = `${sensorName}:`;
  if (!line.startsWith(prefix)) {
    return null;
  }

  const value = Number(line.slice(prefix.length).trim());
  if (![0, 1].includes(value)) {
    return null;
  }

  return value;
}

function parseCommandPayload(command) {
  if (!command.commandPayload) {
    return null;
  }

  try {
    return JSON.parse(command.commandPayload);
  } catch {
    return null;
  }
}

function serialCommandForHardwareCommand(command) {
  if (command.commandType === "open_gate") {
    return "CMD:OPEN_GATE";
  }

  if (command.commandType === "assign_slot") {
    const payload = parseCommandPayload(command);
    const slotId = Number(payload?.slotId);
    if (!Number.isInteger(slotId) || slotId < 1 || slotId > 5) {
      throw new Error("assign_slot command requires slotId 1-5");
    }

    return `CMD:ASSIGN_SLOT:${slotId}`;
  }

  if (command.commandType === "clear_assigned_slot") {
    return "CMD:CLEAR_ASSIGNED_SLOT";
  }

  if (command.commandType === "lockdown_on") {
    return "CMD:LOCKDOWN_ON";
  }

  if (command.commandType === "lockdown_off") {
    return "CMD:LOCKDOWN_OFF";
  }

  throw new Error(`Unsupported command type: ${command.commandType}`);
}

async function handleGateSensorState(sensorName, currentState) {
  const isEntrySensor = sensorName === "ENTRY_SENSOR";
  const lastState = isEntrySensor ? lastEntrySensorState : lastExitSensorState;

  if (isEntrySensor) {
    lastEntrySensorState = currentState;
  } else {
    lastExitSensorState = currentState;
  }

  if (lastState === currentState) {
    return;
  }

  await reportGateSensorState(sensorName, currentState);
}

async function reportSlots(values) {
  const changedValues =
    lastSlotValues === null
      ? values.map((occupied, index) => ({ occupied, index }))
      : values
          .map((occupied, index) => ({ occupied, index }))
          .filter(({ occupied, index }) => occupied !== lastSlotValues[index]);

  if (!changedValues.length) {
    return;
  }

  const slots = changedValues.map(({ occupied, index }) => ({
    slotId: index + 1,
    slotCode: `P${index + 1}`,
    sensorIndex: index + 1,
    isOccupied: occupied === 1,
  }));

  debugLog(`[pi] syncing ${slots.length} changed slot(s): ${JSON.stringify(slots)}`);

  lastQueuedSlotValues = [...values];
  console.log(`[pi] slot snapshot sent: ${JSON.stringify(slots)}`);

  try {
    await requestJson("/api/pi/slots", {
      method: "PUT",
      body: JSON.stringify({ parkingCode, slots }),
    });

    lastSlotValues = [...values];
    console.log("[pi] slot snapshot reply received");
  } catch (error) {
    if (sameSlotValues(lastQueuedSlotValues, values)) {
      lastQueuedSlotValues = null;
    }

    throw error;
  }
}

function handleSlotValues(values) {
  if (sameSlotValues(lastSlotValues, values) || sameSlotValues(lastQueuedSlotValues, values)) {
    return;
  }

  reportSlots(values).catch((error) => {
    console.error("[pi] failed to sync slots:", error.message);
  });
}

async function processCommands() {
  if (isPollingCommands) {
    return;
  }

  isPollingCommands = true;

  const command = await requestJson("/api/pi/commands/claim", {
    method: "POST",
    body: JSON.stringify({ parkingCode, workerId }),
  }).finally(() => {
    isPollingCommands = false;
  });

  if (!command) {
    return;
  }

  try {
    const serialCommand = serialCommandForHardwareCommand(command);
    const sent = serialManager.send(serialCommand);
    if (!sent) {
      throw new Error("Serial port is not connected");
    }

    await requestJson(`/api/pi/commands/${command.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ parkingCode, success: true }),
    });
  } catch (error) {
    await requestJson(`/api/pi/commands/${command.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ parkingCode, success: false, error: error.message }),
    }).catch(() => {});
  }
}

const serialManager = createSerialManager({
  onLine: async (line) => {
    if (!line) {
      return;
    }

    debugLog(`[serial] ${line}`);

    try {
      const entrySensorState = parseGateSensorState(line, "ENTRY_SENSOR");
      if (entrySensorState !== null) {
        await handleGateSensorState("ENTRY_SENSOR", entrySensorState);
        return;
      }

      const exitSensorState = parseGateSensorState(line, "EXIT_SENSOR");
      if (exitSensorState !== null) {
        await handleGateSensorState("EXIT_SENSOR", exitSensorState);
        return;
      }

      if (!line.startsWith("SLOTS:")) {
        return;
      }

      const values = parseSlotValues(line.replace("SLOTS:", ""));
      if (values) {
        handleSlotValues(values);
      }
    } catch (error) {
      console.error("[pi] failed to sync serial event:", error.message);
    }
  },
});

console.log(`[pi] connected to app API ${cloudApiUrl}`);
console.log(`[pi] worker id ${workerId}`);
console.log("[pi] running updated code");

function scheduleCommandPoll(delayMs = pollIntervalMs) {
  if (!enableCommandPolling) {
    return;
  }

  setTimeout(() => {
    processCommands()
      .catch((error) => {
        console.error("[pi] command poll failed:", error.message);
      })
      .finally(() => {
        scheduleCommandPoll(pollIntervalMs);
      });
  }, delayMs);
}

if (enableCommandPolling) {
  console.log(`[pi] command polling enabled (${pollIntervalMs}ms)`);
  scheduleCommandPoll(0);
} else {
  console.log("[pi] command polling disabled");
}
