import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { loginAccount, rateLimit, session, user, verification } from "./auth";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

// Literal table names below must match `authSchemaTableNames` in @relanmo/auth's
// schema-config.ts; database cannot depend on auth, so cross-check lives there.
describe("auth schema fragment", () => {
  it("names tables to stay distinct from provider_accounts", () => {
    expect(getTableConfig(user).name).toBe("user");
    expect(getTableConfig(session).name).toBe("session");
    expect(getTableConfig(loginAccount).name).toBe("login_account");
    expect(getTableConfig(verification).name).toBe("verification");
    expect(getTableConfig(rateLimit).name).toBe("rate_limit");
    expect(getTableConfig(loginAccount).name).not.toBe("provider_accounts");
  });

  it("keeps the documented user columns", () => {
    expect(columnNames(user)).toEqual([
      "id",
      "name",
      "email",
      "email_verified",
      "image",
      "created_at",
      "updated_at",
    ]);
    expect(getTableConfig(user).primaryKeys).toHaveLength(0);
    expect(user.id.primary).toBe(true);
  });

  it("scopes sessions and login accounts to a user with cascade delete and an index", () => {
    const cases = [
      { indexName: "session_userId_idx", table: session },
      { indexName: "loginAccount_userId_idx", table: loginAccount },
    ];
    for (const { table, indexName } of cases) {
      const config = getTableConfig(table);
      expect(config.indexes.map((index) => index.config.name)).toContain(
        indexName
      );
      expect(config.foreignKeys).toHaveLength(1);
      const [foreignKey] = config.foreignKeys;
      expect(foreignKey.onDelete).toBe("cascade");
    }
  });

  it("credentials and session secrets stay in auth-only columns, never product DTO fields", () => {
    expect(columnNames(loginAccount)).toEqual(
      expect.arrayContaining(["password", "access_token", "refresh_token"])
    );
    expect(columnNames(session)).toEqual(expect.arrayContaining(["token"]));
  });

  it("keeps the verification table indexed by identifier", () => {
    const config = getTableConfig(verification);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "verification_identifier_idx"
    );
  });

  it("gives every table's createdAt a DB-level defaultNow(), matching the pinned generator", () => {
    for (const table of [user, session, loginAccount, verification]) {
      expect(table.createdAt.hasDefault).toBe(true);
      expect(table.createdAt.default).toBeDefined();
      expect(table.createdAt.onUpdateFn).toBeUndefined();
    }
  });

  it("gives user/verification updatedAt both defaultNow() and $onUpdate, but session/loginAccount only $onUpdate", () => {
    expect(user.updatedAt.default).toBeDefined();
    expect(verification.updatedAt.default).toBeDefined();
    expect(session.updatedAt.default).toBeUndefined();
    expect(loginAccount.updatedAt.default).toBeUndefined();
    for (const table of [user, session, loginAccount, verification]) {
      expect(table.updatedAt.hasDefault).toBe(true);
      expect(table.updatedAt.onUpdateFn).toBeTypeOf("function");
    }
  });

  it("gives the database-backed rate limit table a unique key", () => {
    expect(rateLimit.key.isUnique).toBe(true);
    expect(columnNames(rateLimit)).toEqual([
      "id",
      "key",
      "count",
      "last_request",
    ]);
  });
});
