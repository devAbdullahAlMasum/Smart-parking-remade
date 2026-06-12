import { asc, desc, eq, ne } from "drizzle-orm";
import { publishRefresh, publishVehicleMovementAlert } from "./realtime.js";
import {
  displayState,
  hardwareCommands,
  parkings,
  parkingSessions,
  parkingSlots,
  runtimeState,
  securityLockdown,
  systemSettings,
  users,
} from "./schema.js";

function now() {
  return new Date().toISOString();
}

function toMillis(value) {
  return value ? new Date(value).getTime() : 0;
}

function mapUser(row) {
  return row
    ? {
        id: row.id,
        authUserId: row.authUserId,
        isDemo: Boolean(row.isDemo ?? row.is_demo),
        name: row.name,
        phone: row.phone,
        licenseNumber: row.licenseNumber,
        vehicleNumber: row.vehicleNumber,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;
}

function mapSession(row) {
  return row
    ? {
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        status: row.status,
        slotId: row.slotId,
        slotCode: row.slotCode,
        assignedAt: row.assignedAt,
        exitedAt: row.exitedAt,
      }
    : null;
}

function mapParking(row) {
  return row
    ? {
        id: row.id,
        name: row.name,
        code: row.code,
        updatedAt: row.updatedAt,
      }
    : null;
}

async function refresh(source) {
  await publishRefresh(source);
}

async function getRuntimeRow(services) {
  const [row] = await services.db.select().from(runtimeState).where(eq(runtimeState.id, 1)).limit(1);
  return row ?? null;
}

async function setSensorCooldown(services, seconds) {
  const updatedAt = now();
  const sensorCooldownUntil = new Date(Date.now() + seconds * 1000).toISOString();

  await services.db
    .insert(runtimeState)
    .values({ id: 1, sensorCooldownUntil, updatedAt })
    .onConflictDoUpdate({
      target: runtimeState.id,
      set: { sensorCooldownUntil, updatedAt },
    });
}

async function isOnCooldown(services) {
  const runtime = await getRuntimeRow(services);
  return Boolean(runtime?.sensorCooldownUntil && toMillis(runtime.sensorCooldownUntil) > Date.now());
}

async function setGateSensorState(services, sensor, isActive) {
  const runtime = await getRuntimeRow(services);
  const entrySensorActive = sensor === "entry" ? isActive : Boolean(runtime?.entrySensorActive);
  const exitSensorActive = sensor === "exit" ? isActive : Boolean(runtime?.exitSensorActive);
  const updatedAt = now();

  await services.db
    .insert(runtimeState)
    .values({
      id: 1,
      sensorCooldownUntil: runtime?.sensorCooldownUntil ?? null,
      entrySensorActive,
      exitSensorActive,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: runtimeState.id,
      set: {
        sensorCooldownUntil: runtime?.sensorCooldownUntil ?? null,
        entrySensorActive,
        exitSensorActive,
        updatedAt,
      },
    });
}

export async function syncGateSensorState(services, sensor, isActive) {
  if (!["entry", "exit"].includes(sensor)) {
    throw new Error("Invalid gate sensor");
  }

  const runtime = await getRuntimeRow(services);
  const currentState = sensor === "entry" ? Boolean(runtime?.entrySensorActive) : Boolean(runtime?.exitSensorActive);

  if (currentState === isActive) {
    return { ok: true, sensor, isActive, ignored: "unchanged" };
  }

  await setGateSensorState(services, sensor, isActive);

  if (!isActive) {
    if (sensor === "entry") {
      setTimeout(async () => {
        try {
          const currentDisplay = await getDisplayState(services);
          if (currentDisplay && (currentDisplay.mode === "assigned" || currentDisplay.mode === "show_qr")) {
            await resetDisplayToIdle(services, "entry_clear");
          }
        } catch (err) {
          console.error("Failed to reset display to idle:", err.message);
        }
      }, 2000);
    }
    return { ok: true, sensor, isActive };
  }

  if (sensor === "entry") {
    return { ...(await triggerEntrySensor(services)), sensor, isActive };
  }

  return { ...(await triggerExitSensor(services)), sensor, isActive };
}

async function getLatestLockdown(services) {
  const [row] = await services.db.select().from(securityLockdown).orderBy(desc(securityLockdown.id)).limit(1);
  return row ?? null;
}

export async function getSetting(services, key, defaultValue) {
  const [row] = await services.db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return row?.value ?? defaultValue;
}

export async function getDisplayState(services) {
  const [row] = await services.db.select().from(displayState).where(eq(displayState.id, 1)).limit(1);
  if (!row) {
    return null;
  }

  if (row.mode === "show_qr" && row.qrExpiresAt && toMillis(row.qrExpiresAt) <= Date.now()) {
    await resetDisplayToIdle(services, "entry_timeout");
    const [fresh] = await services.db.select().from(displayState).where(eq(displayState.id, 1)).limit(1);
    return fresh ?? null;
  }

  return row;
}

export async function setDisplayState(services, input, source = "display") {
  const updatedAt = now();

  await services.db
    .insert(displayState)
    .values({
      id: 1,
      mode: input.mode,
      title: input.title,
      subtitle: input.subtitle,
      qrValue: input.qrValue ?? null,
      assignedSlotCode: input.assignedSlotCode ?? null,
      locationId: input.locationId ?? null,
      qrExpiresAt: input.qrExpiresAt ?? null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: displayState.id,
      set: {
        mode: input.mode,
        title: input.title,
        subtitle: input.subtitle,
        qrValue: input.qrValue ?? null,
        assignedSlotCode: input.assignedSlotCode ?? null,
        locationId: input.locationId ?? null,
        qrExpiresAt: input.qrExpiresAt ?? null,
        updatedAt,
      },
    });

  await refresh(source);
}

export async function resetDisplayToIdle(services, source = "display") {
  await setDisplayState(
    services,
    {
      mode: "idle",
      title: "Waiting for car",
      subtitle: "Drive to Parking in dinajpur to start parking.",
      qrValue: null,
      assignedSlotCode: null,
      locationId: null,
      qrExpiresAt: null,
    },
    source,
  );
}

export async function listSlots(services) {
  const rows = await services.db.select().from(parkingSlots).orderBy(asc(parkingSlots.sensorIndex));
  return rows.map((row) => ({
    id: row.id,
    slotId: row.id,
    slotCode: row.slotCode,
    sensorIndex: row.sensorIndex,
    isOccupied: row.isOccupied,
    updatedAt: row.updatedAt,
  }));
}

export async function listParkings(services) {
  const rows = await services.db.select().from(parkings).orderBy(asc(parkings.id));
  return rows.map(mapParking);
}

export async function getPrimaryParking(services) {
  const [row] = await services.db.select().from(parkings).where(eq(parkings.id, 1)).limit(1);
  return mapParking(row);
}

export async function getRegisteredParkingByCode(services, parkingCode) {
  if (!parkingCode) {
    return null;
  }

  const [row] = await services.db.select().from(parkings).where(eq(parkings.code, parkingCode)).limit(1);
  return mapParking(row);
}

export async function getAllSettings(services) {
  const rows = await services.db.select().from(systemSettings).orderBy(asc(systemSettings.key));
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function updateSetting(services, key, value) {
  const updatedAt = now();

  await services.db
    .insert(systemSettings)
    .values({ key, value: String(value), updatedAt })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: String(value), updatedAt },
    });

  await refresh("settings");
}

export async function getUser(services, userId) {
  const [row] = await services.db.select().from(users).where(eq(users.id, userId)).limit(1);
  return mapUser(row);
}

export async function listDemoUsers(services) {
  const rows = await services.db
    .select()
    .from(users)
    .where(eq(users.isDemo, true))
    .orderBy(desc(users.id));

  return rows.map(mapUser);
}

export async function createDemoUser(services, input) {
  const updatedAt = now();
  const [row] = await services.db
    .insert(users)
    .values({
      isDemo: true,
      authUserId: null,
      name: input.name,
      phone: input.phone,
      licenseNumber: input.licenseNumber,
      vehicleNumber: input.vehicleNumber,
      createdAt: updatedAt,
      updatedAt,
    })
    .returning();

  return mapUser(row);
}

export async function upsertUser(services, input) {
  const updatedAt = now();

  if (input.id) {
    await services.db
      .update(users)
      .set({
        isDemo: Boolean(input.isDemo),
        authUserId: input.authUserId ?? null,
        name: input.name,
        phone: input.phone,
        licenseNumber: input.licenseNumber,
        vehicleNumber: input.vehicleNumber,
        updatedAt,
      })
      .where(eq(users.id, input.id));

    return getUser(services, input.id);
  }

  const [row] = await services.db
    .insert(users)
    .values({
      isDemo: Boolean(input.isDemo),
      authUserId: input.authUserId ?? null,
      name: input.name,
      phone: input.phone,
      licenseNumber: input.licenseNumber,
      vehicleNumber: input.vehicleNumber,
      createdAt: updatedAt,
      updatedAt,
    })
    .returning();

  return mapUser(row);
}

export async function getUserByAuthUserId(services, authUserId) {
  const [row] = await services.db.select().from(users).where(eq(users.authUserId, authUserId)).limit(1);
  return mapUser(row);
}

export async function upsertAuthenticatedUser(services, authUser, input) {
  const existing = await getUserByAuthUserId(services, authUser.id);
  const payload = {
    id: existing?.id,
    authUserId: authUser.id,
    isDemo: false,
    name: input.name?.trim() || authUser.name || authUser.email,
    phone: input.phone?.trim(),
    licenseNumber: input.licenseNumber?.trim(),
    vehicleNumber: input.vehicleNumber?.trim(),
  };

  if (!payload.name || !payload.phone || !payload.licenseNumber || !payload.vehicleNumber) {
    throw new Error("Driver name, phone, license, and vehicle number are required");
  }

  return upsertUser(services, payload);
}

export async function getUserStatus(services, userId) {
  const [session] = await services.db
    .select()
    .from(parkingSessions)
    .where(eq(parkingSessions.userId, userId))
    .orderBy(desc(parkingSessions.id))
    .limit(1);

  const lockdown = await getLatestLockdown(services);

  return {
    session: mapSession(session),
    lockdown: lockdown?.isLocked ?? false,
  };
}

export async function getOpenSessions(services) {
  return services.db
    .select()
    .from(parkingSessions)
    .where(ne(parkingSessions.status, "exited"))
    .orderBy(desc(parkingSessions.id));
}

export async function markSessionStatus(services, sessionId, status) {
  const patch = { status };

  if (status === "parked") {
    patch.exitedAt = null;
    patch.emptySince = null;
    patch.departingSince = null;
  }

  if (status === "departing") {
    patch.exitedAt = null;
  }

  if (status === "exited") {
    patch.exitedAt = now();
    patch.emptySince = null;
    patch.departingSince = null;
  }

  await services.db.update(parkingSessions).set(patch).where(eq(parkingSessions.id, sessionId));

  const [row] = await services.db.select().from(parkingSessions).where(eq(parkingSessions.id, sessionId)).limit(1);
  await refresh("session");
  return mapSession(row);
}

export async function confirmUserDeparture(services, userId) {
  const [session] = await services.db
    .select()
    .from(parkingSessions)
    .where(eq(parkingSessions.userId, userId))
    .orderBy(desc(parkingSessions.id))
    .limit(1);

  if (!session || !["parked", "departing"].includes(session.status)) {
    throw new Error("No departure to confirm");
  }

  await services.db
    .update(parkingSessions)
    .set({ status: "exited", exitedAt: now(), emptySince: null, departingSince: null })
    .where(eq(parkingSessions.id, session.id));

  await enqueueClearAssignedSlot(services, "owner_confirmed_departure");
  await refresh("session");
  return { ok: true };
}

export async function activateLockdown(services) {
  await services.db.insert(securityLockdown).values({
    isLocked: true,
    triggeredAt: now(),
    resolvedAt: null,
  });

  await enqueueCommand(services, "lockdown_on", "security_lockdown");
  await refresh("security");
  return { isLocked: true };
}

export async function enqueueCommand(services, commandType, source, payload = null) {
  const [row] = await services.db
    .insert(hardwareCommands)
    .values({
      commandType,
      commandPayload: payload ? JSON.stringify(payload) : null,
      status: "pending",
      source,
      workerId: null,
      error: null,
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
    })
    .returning();

  return row ?? null;
}

export async function enqueueOpenGate(services, source) {
  return enqueueCommand(services, "open_gate", source);
}

export async function enqueueAssignSlot(services, slotId, source) {
  return enqueueCommand(services, "assign_slot", source, { slotId });
}

export async function enqueueClearAssignedSlot(services, source) {
  return enqueueCommand(services, "clear_assigned_slot", source);
}

export async function claimNextPendingCommand(services, workerId) {
  const [pending] = await services.db
    .select()
    .from(hardwareCommands)
    .where(eq(hardwareCommands.status, "pending"))
    .orderBy(asc(hardwareCommands.id))
    .limit(1);

  if (!pending) {
    return null;
  }

  const startedAt = now();

  await services.db
    .update(hardwareCommands)
    .set({ status: "processing", workerId, startedAt })
    .where(eq(hardwareCommands.id, pending.id));

  return {
    ...pending,
    status: "processing",
    workerId,
    startedAt,
  };
}

export async function completeCommand(services, commandId, success, error) {
  await services.db
    .update(hardwareCommands)
    .set({
      status: success ? "done" : "failed",
      error: error ?? null,
      finishedAt: now(),
    })
    .where(eq(hardwareCommands.id, commandId));
}

export async function requestUnlock(services) {
  await services.db.insert(securityLockdown).values({
    isLocked: false,
    triggeredAt: null,
    resolvedAt: now(),
  });

  await enqueueCommand(services, "lockdown_off", "mobile_unlock");
  await enqueueOpenGate(services, "mobile_unlock");
  await setSensorCooldown(services, 15);
  await refresh("security");
  return { isLocked: false };
}

export async function requestCheckIn(services, userId, locationCode) {
  const user = await getUser(services, userId);
  if (!user) {
    throw new Error("User not found");
  }

  const display = await getDisplayState(services);
  if (!display || display.mode !== "show_qr") {
    throw new Error("No active entry. Trigger entry sensor first.");
  }

  const parking = await getPrimaryParking(services);
  const expectedCode = display.qrValue || parking?.code;
  if (locationCode && expectedCode && String(locationCode).trim() !== String(expectedCode).trim()) {
    throw new Error("Invalid parking code");
  }

  const slots = await listSlots(services);
  const sessions = await getOpenSessions(services);
  const reservedSlotIds = new Set(sessions.map((session) => session.slotId));
  const freeSlot = slots.find((slot) => !slot.isOccupied && !reservedSlotIds.has(slot.id));

  if (!freeSlot) {
    throw new Error("Parking is full");
  }

  const assignedAt = now();
  const [session] = await services.db
    .insert(parkingSessions)
    .values({
      userId: user.id,
      userName: user.name,
      slotId: freeSlot.id,
      slotCode: freeSlot.slotCode,
      status: "active",
      assignedAt,
      exitedAt: null,
      emptySince: null,
      departingSince: null,
    })
    .returning();

  await setDisplayState(
    services,
    {
      mode: "assigned",
      title: `Go to ${freeSlot.slotCode}`,
      subtitle: `${user.name}, your gate is open.`,
      qrValue: null,
      assignedSlotCode: freeSlot.slotCode,
      locationId: 1,
      qrExpiresAt: null,
    },
    "check_in",
  );

  await enqueueOpenGate(services, "mobile_check_in");
  await enqueueAssignSlot(services, freeSlot.id, "mobile_check_in");
  await setSensorCooldown(services, 15);

  return {
    message: "Check-in successful",
    assignedSlotCode: freeSlot.slotCode,
    session: mapSession(session),
  };
}

export async function triggerEntrySensor(services) {
  if (await isOnCooldown(services)) {
    return { ok: true, ignored: "cooldown" };
  }

  const displayTimeoutSeconds = Number(await getSetting(services, "display_timeout_seconds", "30"));
  const qrExpiresAt = new Date(Date.now() + displayTimeoutSeconds * 1000).toISOString();
  const currentDisplay = await getDisplayState(services);

  if (currentDisplay?.mode === "show_qr" && currentDisplay.qrExpiresAt && toMillis(currentDisplay.qrExpiresAt) > Date.now()) {
    return { ok: true, ignored: "already_active" };
  }

  await setDisplayState(
    services,
    {
      mode: "show_qr",
      title: "Scan this QR code",
      subtitle: "Open the app and scan to get your Parking in dinajpur slot.",
      qrValue: process.env.PARKING_CODE || "DINJPUR-PARKING-1",
      assignedSlotCode: null,
      locationId: 1,
      qrExpiresAt,
    },
    "entry_sensor",
  );

  return { ok: true };
}

export async function triggerExitSensor(services) {
  if (await isOnCooldown(services)) {
    return { ok: true, ignored: "cooldown" };
  }

  const lockdown = await getLatestLockdown(services);
  if (lockdown?.isLocked) {
    return { ok: true, ignored: "lockdown" };
  }

  await enqueueOpenGate(services, "exit_sensor");
  await setSensorCooldown(services, 15);
  await resetDisplayToIdle(services, "exit_sensor");
  return { ok: true };
}

async function reconcileSessions(services) {
  const parkedDelayMs = Number(await getSetting(services, "parked_delay_seconds", "120")) * 1000;
  const departingConfirmMs = 4000;
  const slots = await listSlots(services);
  const sessions = await getOpenSessions(services);

  for (const session of sessions) {
    const slot = slots.find((entry) => entry.id === session.slotId);

    if (session.status === "active") {
      const hasTimedOut = Date.now() - toMillis(session.assignedAt) > parkedDelayMs;
      if (slot?.isOccupied || (!slot && hasTimedOut)) {
        await services.db
          .update(parkingSessions)
          .set({ status: "parked", emptySince: null, departingSince: null })
          .where(eq(parkingSessions.id, session.id));
        await enqueueClearAssignedSlot(services, "parked");
      }
      continue;
    }

    if (!slot) {
      continue;
    }

    if (session.status === "parked") {
      if (slot.isOccupied) {
        if (session.emptySince || session.departingSince) {
          await services.db
            .update(parkingSessions)
            .set({ emptySince: null, departingSince: null })
            .where(eq(parkingSessions.id, session.id));
        }
        continue;
      }

      const departedAt = now();
      await services.db
        .update(parkingSessions)
        .set({ status: "departing", emptySince: departedAt, departingSince: departedAt })
        .where(eq(parkingSessions.id, session.id));
      await publishVehicleMovementAlert({
        userId: session.userId,
        sessionId: session.id,
        slotCode: session.slotCode,
        title: "Vehicle movement detected",
        body: `Your car left ${session.slotCode}. Was this you?`,
      });
      continue;
    }

    if (session.status === "departing") {
      if (slot.isOccupied) {
        await services.db
          .update(parkingSessions)
          .set({ status: "parked", emptySince: null, departingSince: null })
          .where(eq(parkingSessions.id, session.id));
        continue;
      }

      const departingSince = session.departingSince || now();
      if (!session.departingSince) {
        await services.db
          .update(parkingSessions)
          .set({ departingSince })
          .where(eq(parkingSessions.id, session.id));
      }

      if (Date.now() - toMillis(departingSince) >= departingConfirmMs) {
        await services.db
          .update(parkingSessions)
          .set({ status: "exited", exitedAt: now(), emptySince: null, departingSince: null })
          .where(eq(parkingSessions.id, session.id));
        await enqueueClearAssignedSlot(services, "session_exited");
      }
    }
  }
}

export async function updateAllSlots(services, slots) {
  if (!slots.length) {
    return;
  }

  const updatedAt = now();
  const currentSlots = await listSlots(services);
  const currentSlotsById = new Map(currentSlots.map((slot) => [slot.id, slot]));
  const changedSlots = slots.filter((slot) => {
    const current = currentSlotsById.get(slot.slotId);
    return (
      !current ||
      current.slotCode !== slot.slotCode ||
      current.sensorIndex !== slot.sensorIndex ||
      current.isOccupied !== Boolean(slot.isOccupied)
    );
  });

  if (!changedSlots.length) {
    return;
  }

  for (const slot of changedSlots) {
    await services.db
      .insert(parkingSlots)
      .values({
        id: slot.slotId,
        slotCode: slot.slotCode,
        sensorIndex: slot.sensorIndex,
        isOccupied: slot.isOccupied,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: parkingSlots.id,
        set: {
          slotCode: slot.slotCode,
          sensorIndex: slot.sensorIndex,
          isOccupied: slot.isOccupied,
          updatedAt,
        },
      });
  }

  await reconcileSessions(services);
  await refresh("slots");
}

export async function getAdminState(services) {
  const [display, slots, parkings, settings] = await Promise.all([
    getDisplayState(services),
    listSlots(services),
    listParkings(services),
    getAllSettings(services),
  ]);

  return { display, slots, parkings, settings };
}
