import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

let servicesPromise;

async function run(client, statement) {
  await client.execute(statement);
}

async function addColumnIfMissing(client, statement) {
  try {
    await client.execute(statement);
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column name")) {
      throw error;
    }
  }
}

async function initDatabase(client) {
  await run(
    client,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_user_id TEXT UNIQUE,
      is_demo INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      license_number TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await addColumnIfMissing(client, "ALTER TABLE users ADD COLUMN auth_user_id TEXT");
  await run(client, "CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id)");
  await addColumnIfMissing(client, "ALTER TABLE users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS parking_slots (
      id INTEGER PRIMARY KEY,
      slot_code TEXT NOT NULL UNIQUE,
      sensor_index INTEGER NOT NULL UNIQUE,
      is_occupied INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS parkings (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS parking_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      slot_id INTEGER NOT NULL,
      slot_code TEXT NOT NULL,
      status TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      exited_at TEXT,
      empty_since TEXT,
      departing_since TEXT
    )`,
  );
  await addColumnIfMissing(client, "ALTER TABLE parking_sessions ADD COLUMN empty_since TEXT");
  await addColumnIfMissing(client, "ALTER TABLE parking_sessions ADD COLUMN departing_since TEXT");

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS display_state (
      id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      qr_value TEXT,
      assigned_slot_code TEXT,
      location_id INTEGER,
      qr_expires_at TEXT,
      updated_at TEXT NOT NULL
    )`,
  );
  await addColumnIfMissing(client, "ALTER TABLE display_state ADD COLUMN qr_expires_at TEXT");

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS security_lockdown (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      is_locked INTEGER NOT NULL,
      triggered_at TEXT,
      resolved_at TEXT
    )`,
  );

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS hardware_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_type TEXT NOT NULL,
      command_payload TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      worker_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT
    )`,
  );
  await addColumnIfMissing(client, "ALTER TABLE hardware_commands ADD COLUMN command_payload TEXT");

  await run(
    client,
    `CREATE TABLE IF NOT EXISTS runtime_state (
      id INTEGER PRIMARY KEY,
      sensor_cooldown_until TEXT,
      entry_sensor_active INTEGER NOT NULL DEFAULT 0,
      exit_sensor_active INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
  );
  await addColumnIfMissing(client, "ALTER TABLE runtime_state ADD COLUMN entry_sensor_active INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(client, "ALTER TABLE runtime_state ADD COLUMN exit_sensor_active INTEGER NOT NULL DEFAULT 0");

  const now = new Date().toISOString();

  for (let index = 1; index <= 5; index += 1) {
    await run(
      client,
      `INSERT OR IGNORE INTO parking_slots (id, slot_code, sensor_index, is_occupied, updated_at)
       VALUES (${index}, 'P${index}', ${index}, 0, '${now}')`,
    );
  }

  await run(
    client,
    `INSERT OR IGNORE INTO parkings (id, name, code, updated_at)
     VALUES (1, 'Parking in dinajpur', '${process.env.PARKING_CODE || "DINJPUR-PARKING-1"}', '${now}')`,
  );

  await run(
    client,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at)
     VALUES ('display_timeout_seconds', '30', '${now}')`,
  );
  await run(
    client,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at)
     VALUES ('gate_open_seconds', '5', '${now}')`,
  );
  await run(
    client,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at)
     VALUES ('parked_delay_seconds', '120', '${now}')`,
  );

  await run(
    client,
    `INSERT OR IGNORE INTO display_state (id, mode, title, subtitle, qr_value, assigned_slot_code, location_id, qr_expires_at, updated_at)
     VALUES (1, 'idle', 'Waiting for car', 'Drive to the gate to start parking.', NULL, NULL, NULL, NULL, '${now}')`,
  );

  await run(
    client,
    `INSERT OR IGNORE INTO security_lockdown (id, is_locked, triggered_at, resolved_at)
     VALUES (1, 0, NULL, '${now}')`,
  );

  await run(
    client,
    `INSERT OR IGNORE INTO runtime_state (id, sensor_cooldown_until, entry_sensor_active, exit_sensor_active, updated_at)
     VALUES (1, NULL, 0, 0, '${now}')`,
  );
}

export async function getServices() {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      if (!process.env.TURSO_DATABASE_URL) {
        throw new Error("TURSO_DATABASE_URL is required.");
      }

      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });

      await initDatabase(client);

      return {
        client,
        db: drizzle(client),
      };
    })();
  }

  return servicesPromise;
}
