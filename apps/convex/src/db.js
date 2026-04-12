const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

const dataDir = path.dirname(config.dbPath);
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_number TEXT NOT NULL,
    vehicle_number TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parking_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code_value TEXT NOT NULL UNIQUE,
    screen_label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parking_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_code TEXT NOT NULL UNIQUE,
    sensor_index INTEGER NOT NULL UNIQUE,
    is_occupied INTEGER NOT NULL DEFAULT 0,
    assigned_session_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parking_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    parking_location_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exited_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id),
    FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS security_lockdown (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_locked INTEGER NOT NULL DEFAULT 0,
    triggered_at TEXT,
    resolved_at TEXT
  );
`);

const slotCount = db.prepare("SELECT COUNT(*) AS count FROM parking_slots").get().count;
if (slotCount === 0) {
  const insertSlot = db.prepare(
    "INSERT INTO parking_slots (slot_code, sensor_index) VALUES (?, ?)",
  );

  for (let i = 1; i <= 5; i += 1) {
    insertSlot.run(`P${i}`, i);
  }
}

const locationCount = db.prepare("SELECT COUNT(*) AS count FROM parking_locations").get().count;
if (locationCount === 0) {
  db.prepare("INSERT INTO parking_locations (name, code_value, screen_label) VALUES (?, ?, ?)").run(
    "Main Gate QR",
    "LOCATION:1",
    "Main Gate QR",
  );
}

// Seed default settings if not present
const settingsCount = db.prepare("SELECT COUNT(*) AS count FROM system_settings").get().count;
if (settingsCount === 0) {
  const insertSetting = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
  insertSetting.run("display_timeout_seconds", "30");
  insertSetting.run("gate_open_seconds", "5");
  insertSetting.run("parked_delay_seconds", "120");
}

// Initialize lockdown record if not present
const lockdownCount = db.prepare("SELECT COUNT(*) AS count FROM security_lockdown").get().count;
if (lockdownCount === 0) {
  db.prepare("INSERT INTO security_lockdown (is_locked) VALUES (0)").run();
}

function listSlots() {
  return db
    .prepare(
      `SELECT id, slot_code AS slotCode, sensor_index AS sensorIndex, is_occupied AS isOccupied, assigned_session_id AS assignedSessionId
     FROM parking_slots
     ORDER BY sensor_index ASC`,
    )
    .all();
}

function listLocations() {
  return db
    .prepare(
      "SELECT id, name, code_value AS codeValue, screen_label AS screenLabel FROM parking_locations ORDER BY id ASC",
    )
    .all();
}

function getLocationById(id) {
  return db
    .prepare(
      "SELECT id, name, code_value AS codeValue, screen_label AS screenLabel FROM parking_locations WHERE id = ?",
    )
    .get(id);
}

function getLocationByCodeValue(codeValue) {
  return db
    .prepare(
      "SELECT id, name, code_value AS codeValue, screen_label AS screenLabel FROM parking_locations WHERE code_value = ?",
    )
    .get(codeValue);
}

function createUser(input) {
  const result = db
    .prepare(
      `INSERT INTO users (name, phone, license_number, vehicle_number)
     VALUES (@name, @phone, @license_number, @vehicle_number)`,
    )
    .run(input);

  return getUserById(result.lastInsertRowid);
}

function updateUser(id, input) {
  db.prepare(
    `UPDATE users
     SET name = @name,
         phone = @phone,
         license_number = @license_number,
         vehicle_number = @vehicle_number,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`,
  ).run({ ...input, id });

  return getUserById(id);
}

function getUserById(id) {
  return db
    .prepare(
      `SELECT id, name, phone, license_number AS licenseNumber, vehicle_number AS vehicleNumber,
            created_at AS createdAt, updated_at AS updatedAt
     FROM users
     WHERE id = ?`,
    )
    .get(id);
}

function getFirstAvailableSlot() {
  return db
    .prepare(
      `SELECT id, slot_code AS slotCode, sensor_index AS sensorIndex
     FROM parking_slots
     WHERE is_occupied = 0
     ORDER BY sensor_index ASC
     LIMIT 1`,
    )
    .get();
}

function createParkingSession({ userId, parkingLocationId, slotId }) {
  const result = db
    .prepare(
      `INSERT INTO parking_sessions (user_id, parking_location_id, slot_id, status)
     VALUES (?, ?, ?, 'active')`,
    )
    .run(userId, parkingLocationId, slotId);

  db.prepare(
    `UPDATE parking_slots
     SET assigned_session_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(result.lastInsertRowid, slotId);

  return getSessionById(result.lastInsertRowid);
}

function getSessionById(id) {
  return db
    .prepare(
      `SELECT ps.id, ps.status, ps.assigned_at AS assignedAt, ps.exited_at AS exitedAt,
            u.id AS userId, u.name,
            pl.id AS parkingLocationId, pl.name AS parkingLocationName,
            s.id AS slotId, s.slot_code AS slotCode
     FROM parking_sessions ps
     JOIN users u ON u.id = ps.user_id
     JOIN parking_locations pl ON pl.id = ps.parking_location_id
     JOIN parking_slots s ON s.id = ps.slot_id
     WHERE ps.id = ?`,
    )
    .get(id);
}

function listActiveSessions() {
  return db
    .prepare(
      `SELECT ps.id, ps.status, ps.assigned_at AS assignedAt,
            u.name,
            s.slot_code AS slotCode,
            s.sensor_index AS sensorIndex,
            s.is_occupied AS isOccupied
     FROM parking_sessions ps
     JOIN users u ON u.id = ps.user_id
     JOIN parking_slots s ON s.id = ps.slot_id
     WHERE ps.status IN ('active', 'parked', 'departing')
     ORDER BY ps.assigned_at ASC`,
    )
    .all();
}

function listAllNonExitedSessions() {
  // Only return the latest (most recent) session per slot — older sessions are stale
  return db
    .prepare(
      `SELECT ps.id, ps.status, ps.assigned_at AS assignedAt,
            ps.user_id AS userId,
            s.id AS slotId,
            s.slot_code AS slotCode,
            s.is_occupied AS isOccupied
     FROM parking_sessions ps
     JOIN parking_slots s ON s.id = ps.slot_id
     WHERE ps.status IN ('active', 'parked', 'departing')
       AND ps.id = (
         SELECT MAX(ps2.id) FROM parking_sessions ps2
         WHERE ps2.slot_id = ps.slot_id AND ps2.status IN ('active', 'parked', 'departing')
       )
     ORDER BY ps.assigned_at ASC`,
    )
    .all();
}

function getSessionByUserId(userId) {
  return db
    .prepare(
      `SELECT ps.id, ps.status, ps.assigned_at AS assignedAt, ps.exited_at AS exitedAt,
            u.id AS userId,
            s.id AS slotId, s.slot_code AS slotCode
     FROM parking_sessions ps
     JOIN users u ON u.id = ps.user_id
     JOIN parking_slots s ON s.id = ps.slot_id
     WHERE ps.user_id = ? AND ps.status IN ('active', 'parked', 'departing')
     ORDER BY ps.assigned_at DESC
     LIMIT 1`,
    )
    .get(userId);
}

function closeSession(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) {
    return null;
  }

  db.prepare(
    `UPDATE parking_sessions
     SET status = 'exited', exited_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(sessionId);

  db.prepare(
    `UPDATE parking_slots
     SET assigned_session_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(session.slotId);

  return getSessionById(sessionId);
}

function setSlotOccupancy(sensorValues) {
  const update = db.prepare(
    `UPDATE parking_slots
     SET is_occupied = ?, updated_at = CURRENT_TIMESTAMP
     WHERE sensor_index = ?`,
  );

  const transaction = db.transaction((values) => {
    values.forEach((isOccupied, index) => {
      update.run(isOccupied ? 1 : 0, index + 1);
    });
  });

  transaction(sensorValues);
}

function getStateSummary() {
  const slots = listSlots();
  const activeSessions = listActiveSessions();
  const occupiedCount = slots.filter((slot) => slot.isOccupied).length;
  const availableCount = slots.filter((slot) => !slot.isOccupied).length;

  return {
    slots,
    activeSessions,
    occupiedCount,
    availableCount,
  };
}

// --- Settings helpers ---
function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM system_settings").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

function getSetting(key, defaultValue) {
  const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key);
  return row ? row.value : defaultValue;
}

function updateSetting(key, value) {
  db.prepare(
    `UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`,
  ).run(String(value), key);
  return getAllSettings();
}

function markSessionAsParked(sessionId) {
  db.prepare(
    `UPDATE parking_sessions SET status = 'parked' WHERE id = ? AND status = 'active'`,
  ).run(sessionId);
  return getSessionById(sessionId);
}

function markSessionAsDeparting(sessionId) {
  db.prepare(
    `UPDATE parking_sessions SET status = 'departing' WHERE id = ? AND status = 'parked'`,
  ).run(sessionId);
  return getSessionById(sessionId);
}

// --- Lockdown helpers ---
function getLockdownState() {
  const row = db
    .prepare(
      "SELECT is_locked AS isLocked, triggered_at AS triggeredAt, resolved_at AS resolvedAt FROM security_lockdown ORDER BY id DESC LIMIT 1",
    )
    .get();
  return row || { isLocked: 0, triggeredAt: null, resolvedAt: null };
}

function setLockdown(isLocked) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO security_lockdown (is_locked, triggered_at, resolved_at) VALUES (?, ?, ?)",
  ).run(isLocked ? 1 : 0, isLocked ? now : null, !isLocked ? now : null);
  return getLockdownState();
}

module.exports = {
  db,
  createParkingSession,
  createUser,
  closeSession,
  getFirstAvailableSlot,
  getLocationByCodeValue,
  getLocationById,
  getSessionById,
  getSessionByUserId,
  getStateSummary,
  getUserById,
  listActiveSessions,
  listAllNonExitedSessions,
  listLocations,
  listSlots,
  setSlotOccupancy,
  updateUser,
  getAllSettings,
  getSetting,
  updateSetting,
  markSessionAsParked,
  markSessionAsDeparting,
  getLockdownState,
  setLockdown,
};
