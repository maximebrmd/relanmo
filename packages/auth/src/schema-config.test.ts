import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  loginAccount,
  rateLimit,
  session,
  user,
  verification,
} from "@relanmo/database/schema/auth";

import {
  authSchemaConfig,
  authSchemaGeneratorVersions,
  authSchemaTableNames,
} from "./schema-config";

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

  it("matches the committed Drizzle table names", () => {
    expect({
      loginAccount: getTableConfig(loginAccount).name,
      rateLimit: getTableConfig(rateLimit).name,
      session: getTableConfig(session).name,
      user: getTableConfig(user).name,
      verification: getTableConfig(verification).name,
    }).toEqual(authSchemaTableNames);
  });
});
