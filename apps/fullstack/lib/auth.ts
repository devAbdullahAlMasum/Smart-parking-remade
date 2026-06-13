import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authDb } from "./auth-db";
import * as authSchema from "./auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "sqlite",
    schema: authSchema,
  }),
  advanced: {
    disableCSRFCheck: true,
    disableOriginCheck: true,
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [expo()],
});
