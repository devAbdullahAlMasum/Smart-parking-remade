import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number").notNull(),
  vehicleNumber: text("vehicle_number").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const parkingSlots = sqliteTable("parking_slots", {
  id: integer("id").primaryKey(),
  slotCode: text("slot_code").notNull().unique(),
  sensorIndex: integer("sensor_index").notNull().unique(),
  isOccupied: integer("is_occupied", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const parkingSessions = sqliteTable("parking_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  slotId: integer("slot_id").notNull(),
  slotCode: text("slot_code").notNull(),
  status: text("status").notNull(),
  assignedAt: text("assigned_at").notNull(),
  exitedAt: text("exited_at"),
  emptySince: text("empty_since"),
  departingSince: text("departing_since"),
});

export const displayState = sqliteTable("display_state", {
  id: integer("id").primaryKey(),
  mode: text("mode").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  qrValue: text("qr_value"),
  assignedSlotCode: text("assigned_slot_code"),
  locationId: integer("location_id"),
  qrExpiresAt: text("qr_expires_at"),
  updatedAt: text("updated_at").notNull(),
});

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const securityLockdown = sqliteTable("security_lockdown", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull(),
  triggeredAt: text("triggered_at"),
  resolvedAt: text("resolved_at"),
});

export const hardwareCommands = sqliteTable("hardware_commands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commandType: text("command_type").notNull(),
  status: text("status").notNull(),
  source: text("source").notNull(),
  workerId: text("worker_id"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

export const runtimeState = sqliteTable("runtime_state", {
  id: integer("id").primaryKey(),
  sensorCooldownUntil: text("sensor_cooldown_until"),
  entrySensorActive: integer("entry_sensor_active", { mode: "boolean" }).notNull().default(false),
  exitSensorActive: integer("exit_sensor_active", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});
