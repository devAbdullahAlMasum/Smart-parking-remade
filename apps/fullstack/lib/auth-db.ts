import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./auth-schema";

const authDatabaseUrl = process.env.AUTH_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authDatabaseToken = process.env.AUTH_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

if (!authDatabaseUrl) {
  throw new Error("AUTH_TURSO_DATABASE_URL is required for Better Auth.");
}

export const authDbClient = createClient({
  url: authDatabaseUrl,
  authToken: authDatabaseToken,
});

export const authDb = drizzle(authDbClient, { schema });
