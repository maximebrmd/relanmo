import { describe, expect, it } from "vitest";

import {
  authSchemaConfig,
  authSchemaGeneratorVersions,
  authSchemaTableNames,
} from "./schema-config";

// Table name literals here must match @relanmo/database/schema/auth's pgTable
// names; packages/auth cannot import packages/database's schema back (auth
// already depends on database, so the reverse edge would be circular), so
// the cross-check lives as parallel literals reviewed together in both files.
describe("auth schema-config", () => {
  it("renames the login account table away from Better Auth's default and provider_accounts", () => {
    expect(authSchemaConfig.account.modelName).toBe("login_account");
    expect(authSchemaConfig.account.modelName).toBe(
      authSchemaTableNames.loginAccount
    );
    expect(authSchemaConfig.account.modelName).not.toBe("account");
    expect(authSchemaConfig.account.modelName).not.toBe("provider_accounts");
  });

  it("keeps email/password and database-backed rate limiting enabled", () => {
    expect(authSchemaConfig.emailAndPassword.enabled).toBe(true);
    expect(authSchemaConfig.rateLimit.enabled).toBe(true);
    expect(authSchemaConfig.rateLimit.storage).toBe("database");
  });

  it("pins the generator to the same release as the better-auth runtime dependency", () => {
    expect(authSchemaGeneratorVersions.betterAuth).toBe(
      authSchemaGeneratorVersions.drizzleAdapter
    );
  });
});
