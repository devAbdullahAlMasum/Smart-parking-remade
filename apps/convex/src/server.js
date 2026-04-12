import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createSerialManager } from "./serial.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env.local then .env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

// Convex cloud URL from .env.local
const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("[error] CONVEX_URL not set. Run `npx convex dev` first.");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);
console.log(`[convex] → ${CONVEX_URL}`);

let pendingEntry = null;
let sensorCooldownUntil = 0;
const SENSOR_COOLDOWN_MS = 15000;
const DEPARTING_CONFIRM_MS = 4000;
const slotEmptySince = new Map();
const departingSince = new Map();

async function getSetting(key, defaultValue) {
  try {
    return await convex.query(api.settings.getSetting, { key, defaultValue });
  } catch {
    return defaultValue;
  }
}

async function getDisplayTimeoutMs() {
  const fallbackMs = Number(process.env.ENTRY_WINDOW_MS || 30000);
  const seconds = Number(await getSetting("display_timeout_seconds", String(fallbackMs / 1000)));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
}

async function setDisplay(fields) {
  try {
    await convex.mutation(api.display.setDisplayState, {
      mode: fields.mode,
      title: fields.title,
      subtitle: fields.subtitle,
      qrValue: fields.qrValue || undefined,
      assignedSlotCode: fields.assignedSlotCode || undefined,
      locationId: fields.locationId || undefined,
    });
  } catch (err) {
    console.log("[convex] setDisplay failed:", err.message);
  }
}

async function resetDisplayToIdle() {
  pendingEntry = null;
  await setDisplay({
    mode: "idle",
    title: "Waiting for car",
    subtitle: "Drive to the gate to start parking.",
    qrValue: null,
    assignedSlotCode: null,
    locationId: null,
  });
}

async function handleEntrySensor() {
  if (Date.now() < sensorCooldownUntil) {
    console.log("[entry] ignored — cooldown");
    return;
  }
  if (pendingEntry) {
    console.log("[entry] ignored — already pending");
    return;
  }

  pendingEntry = { expiresAt: Date.now() + (await getDisplayTimeoutMs()) };

  await setDisplay({
    mode: "show_qr",
    title: "Scan this QR code",
    subtitle: "Open the app and scan to get your parking slot.",
    qrValue: "LOCATION:1",
    assignedSlotCode: null,
    locationId: 1,
  });
}

async function handleExitSensor() {
  if (Date.now() < sensorCooldownUntil) {
    console.log("[exit] ignored — cooldown");
    return;
  }

  // Check lockdown
  try {
    const ld = await convex.query(api.status.getUserStatus, { userId: 0 });
    if (ld?.lockdown) {
      console.log("[exit] ignored — lockdown");
      return;
    }
  } catch {}

  serialManager.send("CMD:OPEN_GATE");
  sensorCooldownUntil = Date.now() + SENSOR_COOLDOWN_MS;
  console.log("[exit] gate opened, cooldown started");
  setTimeout(() => resetDisplayToIdle(), 3000);
}

function parseSlotValues(raw) {
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length !== 5) return null;
  const values = parts.map(Number);
  if (values.some((v) => Number.isNaN(v) || ![0, 1].includes(v))) return null;
  return values;
}

const serialManager = createSerialManager({
  onLine: async (line) => {
    if (!line) return;
    console.log(`[serial] ${line}`);

    if (line === "EVENT:ENTRY_SENSOR") {
      await handleEntrySensor();
      return;
    }

    if (line === "EVENT:EXIT_SENSOR") {
      await handleExitSensor();
      return;
    }

    if (line.startsWith("SLOTS:")) {
      const values = parseSlotValues(line.replace("SLOTS:", ""));
      if (values) {
        console.log(`[slots] IR → P1:${values[0]} P2:${values[1]} P3:${values[2]} P4:${values[3]} P5:${values[4]}`);
        const slots = values.map((occ, i) => ({
          slotId: i + 1,
          slotCode: `P${i + 1}`,
          sensorIndex: i + 1,
          isOccupied: occ === 1,
        }));
        convex.mutation(api.sensors.updateAllSlots, { slots }).catch(() => {});
      }
    }
  },
});

// Status manager loop: keep mobile status aligned with the assigned slot sensor.
setInterval(async () => {
  // Expire pending entry
  if (pendingEntry && Date.now() > pendingEntry.expiresAt) {
    resetDisplayToIdle();
  }

  const parkedDelayMs = Number(await getSetting("parked_delay_seconds", "120")) * 1000;
  const slots = await convex.query(api.sensors.getAllSlots).catch(() => []);

  // Check all active sessions
  for (let userId = 1; userId <= 20; userId++) {
    try {
      const result = await convex.query(api.status.getUserStatus, { userId });
      const session = result?.session;
      if (!session || session.status === "exited") continue;

      const slot = slots.find((entry) => entry.slotId === session.slotId);

      if (session.status === "active") {
        const assignedTime = new Date(session.assignedAt).getTime();
        const hasTimedOut = Date.now() - assignedTime > parkedDelayMs;

        if (slot?.isOccupied || (!slot && hasTimedOut)) {
          await convex.mutation(api.status.markParked, { sessionId: session._id });
          console.log(`[status] userId=${userId} → parked (${session.slotCode})`);
        }
      }

      if (session.status === "parked" || session.status === "departing") {
        if (!slot) continue;

        if (!slot.isOccupied && session.status === "parked") {
          const emptySince = slotEmptySince.get(session.slotId) ?? Date.now();
          slotEmptySince.set(session.slotId, emptySince);

          if (Date.now() - emptySince >= DEPARTING_CONFIRM_MS) {
            departingSince.set(session._id, Date.now());
            await convex.mutation(api.status.markDeparting, { sessionId: session._id });
            console.log(`[status] userId=${userId} → departing (IR empty: ${session.slotCode})`);
          }
        } else if (slot.isOccupied && session.status === "departing") {
          slotEmptySince.delete(session.slotId);
          departingSince.delete(session._id);
          await convex.mutation(api.status.markParked, { sessionId: session._id });
          console.log(`[status] userId=${userId} → parked again (IR: ${session.slotCode})`);
        } else if (slot.isOccupied) {
          slotEmptySince.delete(session.slotId);
          departingSince.delete(session._id);
        } else if (!slot.isOccupied && session.status === "departing") {
          const startedAt = departingSince.get(session._id) ?? Date.now();
          departingSince.set(session._id, startedAt);

          if (Date.now() - startedAt >= DEPARTING_CONFIRM_MS) {
            slotEmptySince.delete(session.slotId);
            departingSince.delete(session._id);
            await convex.mutation(api.status.markExited, { sessionId: session._id });
            console.log(`[status] userId=${userId} → exited (${session.slotCode})`);
          }
        }
      }
    } catch {
      // Convex not ready or no session for this user
    }
  }
}, 1000);

// --- Thin REST bridge for mobile check-in and user management ---
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json());

// User registration (mobile app doesn't have Convex client yet at this screen)
app.post("/api/users", async (req, res) => {
  const { name, phone, licenseNumber, vehicleNumber } = req.body;
  if (!name || !phone || !licenseNumber || !vehicleNumber) {
    return res.status(400).json({ message: "All fields required" });
  }
  const user = await convex.mutation(api.status.upsertUser, {
    name: name.trim(),
    phone: phone.trim(),
    licenseNumber: licenseNumber.trim(),
    vehicleNumber: vehicleNumber.trim(),
  });
  res.status(201).json(user);
});

app.put("/api/users/:id", async (req, res) => {
  const { name, phone, licenseNumber, vehicleNumber } = req.body;
  if (!name || !phone || !licenseNumber || !vehicleNumber) {
    return res.status(400).json({ message: "All fields required" });
  }
  const user = await convex.mutation(api.status.upsertUser, {
    id: Number(req.params.id),
    name: name.trim(),
    phone: phone.trim(),
    licenseNumber: licenseNumber.trim(),
    vehicleNumber: vehicleNumber.trim(),
  });
  res.json(user);
});

app.get("/api/users/:id", async (req, res) => {
  const user = await convex.query(api.status.getUser, { userId: Number(req.params.id) });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

app.get("/api/users/:id/status", async (req, res) => {
  try {
    const result = await convex.query(api.status.getUserStatus, { userId: Number(req.params.id) });
    res.json(result);
  } catch {
    res.json({ session: null, lockdown: false });
  }
});

app.post("/api/check-in", async (req, res) => {
  const { userId } = req.body;
  const user = await convex.query(api.status.getUser, { userId: Number(userId) });
  if (!user) return res.status(404).json({ message: "User not found" });

  if (!pendingEntry) {
    return res.status(409).json({ message: "No active entry. Trigger entry sensor first." });
  }

  const slots = await convex.query(api.sensors.getAllSlots);
  const freeSlot = slots.find((s) => !s.isOccupied);
  if (!freeSlot) return res.status(409).json({ message: "Parking is full" });

  const session = await convex.mutation(api.status.createSession, {
    userId: user.id,
    userName: user.name,
    status: "active",
    slotCode: freeSlot.slotCode,
    slotId: freeSlot.slotId,
    assignedAt: new Date().toISOString(),
  });

  serialManager.send("CMD:OPEN_GATE");
  sensorCooldownUntil = Date.now() + SENSOR_COOLDOWN_MS;
  pendingEntry = null;

  await setDisplay({
    mode: "assigned",
    title: `Go to ${freeSlot.slotCode}`,
    subtitle: `${user.name}, your gate is open.`,
    qrValue: null,
    assignedSlotCode: freeSlot.slotCode,
  });

  res.status(201).json({ message: "Check-in successful", session, assignedSlotCode: freeSlot.slotCode });
});

app.post("/api/security/lockdown", async (_req, res) => {
  await convex.mutation(api.status.activateLockdown);
  res.json({ message: "Lockdown activated" });
});

app.post("/api/security/unlock", async (_req, res) => {
  await convex.mutation(api.status.deactivateLockdown);
  serialManager.send("CMD:OPEN_GATE");
  res.json({ message: "Lockdown deactivated" });
});

// Admin sensor simulation
app.post("/api/admin/entry", (_req, res) => {
  handleEntrySensor().catch(() => {});
  res.json({ message: "Entry event simulated" });
});

app.post("/api/admin/exit", async (_req, res) => {
  await handleExitSensor();
  res.json({ message: "Exit event simulated" });
});

app.get("/api/admin/settings", async (_req, res) => {
  const settings = await convex.query(api.settings.getAllSettings);
  res.json(settings);
});

app.put("/api/admin/settings", async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ message: "key and value required" });
  await convex.mutation(api.settings.updateSetting, { key, value: String(value) });
  res.json({ ok: true });
});

// Init settings
convex.mutation(api.settings.initSettings).catch(() => {});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`smart parking bridge on http://${HOST}:${PORT}`);
  resetDisplayToIdle();
});
