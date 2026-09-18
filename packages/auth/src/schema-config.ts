import type { BetterAuthOptions } from "better-auth";

// Generator is published as package "auth" (bin: auth/better-auth), pinned to the better-auth version for reproducible output.
export const authSchemaGeneratorVersions = {
  betterAuth: "1.7.5",
  drizzleAdapter: "1.7.5",
  drizzleOrm: "0.45.2",
  generatorCommand:
    "bunx auth@1.7.5 generate --config <config> --output <output>",
  pg: "8.23.0",
} as const;

// loginAccount stays distinct from provider_accounts, which stores connected LinkedIn accounts.
export const authSchemaTableNames = {
  loginAccount: "login_account",
  rateLimit: "rate_limit",
  session: "session",
  user: "user",
  verification: "verification",
} as const;

// Schema-relevant options only; route handlers, secrets and social providers belong to the later server-wiring task.
export const authSchemaConfig = {
  account: {
    modelName: authSchemaTableNames.loginAccount,
  },
  appName: "Relanmo",
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
} satisfies Pick<
  BetterAuthOptions,
  "account" | "appName" | "emailAndPassword" | "rateLimit"
>;
