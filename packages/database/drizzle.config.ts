import { defineConfig } from "drizzle-kit";

/**
 * Generate reviewed SQL from this package:
 * `bun x --no-install drizzle-kit generate --name initial`
 *
 * Apply that SQL with the unpooled migration role:
 * `bun tooling/database/migrate.ts`
 *
 * `DATABASE_URL` is the pooled runtime connection. Migrations read
 * `DATABASE_URL_UNPOOLED` only; this config is for generate/check and does
 * not open a database.
 */
export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle",
  schema: [
    "./src/schema/audit.ts",
    "./src/schema/auth.ts",
    "./src/schema/billing.ts",
    "./src/schema/campaigns.ts",
    "./src/schema/delivery.ts",
    "./src/schema/leads.ts",
    "./src/schema/styles.ts",
    "./src/schema/tenancy.ts",
  ],
  strict: true,
  verbose: true,
});
