import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "./auth-db";
import * as authSchema from "./auth-schema";

const trustedOrigins = ["smartparking://", "smartparking://*", "exp://*"];

if (process.env.NODE_ENV !== "production") {
  trustedOrigins.push("http://localhost:*", "http://127.0.0.1:*");
}

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "sqlite",
    schema: authSchema,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [expo()],
});
