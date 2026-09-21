import { describe, expect, it } from "vitest";

import { DatabaseConfigError, parseDatabaseEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgres://runtime:pass@pooler.example.com:5432/app",
  DATABASE_URL_UNPOOLED:
    "postgres://migration:pass@direct.example.com:5432/app",
};

describe("parseDatabaseEnv", () => {
  it("parses a complete, valid environment with defaults", () => {
    const env = parseDatabaseEnv(VALID_ENV);
    expect(env.runtimeUrl).toBe(VALID_ENV.DATABASE_URL);
    expect(env.migrationUrl).toBe(VALID_ENV.DATABASE_URL_UNPOOLED);
    expect(env.poolMax).toBeGreaterThan(0);
    expect(env.poolIdleTimeoutMs).toBeGreaterThan(0);
    expect(env.poolConnectionTimeoutMs).toBeGreaterThan(0);
  });

  it("honors an explicit, in-bounds pool size", () => {
    const env = parseDatabaseEnv({ ...VALID_ENV, DATABASE_POOL_MAX: "3" });
    expect(env.poolMax).toBe(3);
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL_UNPOOLED: VALID_ENV.DATABASE_URL_UNPOOLED,
      })
    ).toThrow(DatabaseConfigError);
  });

  it("fails clearly when DATABASE_URL_UNPOOLED is missing", () => {
    expect(() =>
      parseDatabaseEnv({ DATABASE_URL: VALID_ENV.DATABASE_URL })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects a blank connection string", () => {
    expect(() =>
      parseDatabaseEnv({ ...VALID_ENV, DATABASE_URL: "   " })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects a malformed connection URL", () => {
    expect(() =>
      parseDatabaseEnv({ ...VALID_ENV, DATABASE_URL: "not-a-url" })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects a non-postgres connection scheme", () => {
    expect(() =>
      parseDatabaseEnv({
        ...VALID_ENV,
        DATABASE_URL: "mysql://user:pass@host:3306/app",
      })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects a connection string without an explicit database username", () => {
    expect(() =>
      parseDatabaseEnv({
        ...VALID_ENV,
        DATABASE_URL_UNPOOLED: "postgres://direct.example.com:5432/app",
      })
    ).toThrow(
      "DATABASE_URL_UNPOOLED must include an explicit database username"
    );
  });

  it("rejects an identical runtime and migration URL", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        DATABASE_URL_UNPOOLED: VALID_ENV.DATABASE_URL,
      })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects the same endpoint spelled with an equivalent scheme", () => {
    // postgres:// and postgresql:// name the same endpoint; a raw string
    // comparison would miss this and let runtime traffic reuse the
    // privileged migration connection.
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: "postgres://user:pass@priv-host:5432/app",
        DATABASE_URL_UNPOOLED: "postgresql://user:pass@priv-host:5432/app",
      })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects the same endpoint with an explicit default port vs. an omitted one", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: "postgres://user:pass@priv-host/app",
        DATABASE_URL_UNPOOLED: "postgres://user:pass@priv-host:5432/app",
      })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects different endpoints that use the same database principal", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: "postgres://shared:pass@host:5432/app",
        DATABASE_URL_UNPOOLED: "postgres://shared:pass@host:5433/app",
      })
    ).toThrow(
      "DATABASE_URL and DATABASE_URL_UNPOOLED must use distinct database usernames"
    );
  });

  it("rejects query parameters that override the database principal", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: "postgres://runtime:pass@host:5432/app?user=shared",
        DATABASE_URL_UNPOOLED:
          "postgres://migration:pass@host:5433/app?user=shared",
      })
    ).toThrow(
      "DATABASE_URL must set the database username in the URL authority"
    );
  });

  it("rejects the same database principal with percent-encoded characters", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: "postgres://runtime:pass@host:5432/app",
        DATABASE_URL_UNPOOLED: "postgres://%72untime:pass@host:5433/app",
      })
    ).toThrow(
      "DATABASE_URL and DATABASE_URL_UNPOOLED must use distinct database usernames"
    );
  });

  it("accepts separate endpoints with distinct database principals", () => {
    const env = parseDatabaseEnv({
      DATABASE_URL: "postgres://runtime:pass@host:5432/app",
      DATABASE_URL_UNPOOLED: "postgres://migration:pass@host:5433/app",
    });
    expect(env.runtimeUrl).toBe("postgres://runtime:pass@host:5432/app");
    expect(env.migrationUrl).toBe("postgres://migration:pass@host:5433/app");
  });

  it("rejects a non-numeric pool size", () => {
    expect(() =>
      parseDatabaseEnv({ ...VALID_ENV, DATABASE_POOL_MAX: "not-a-number" })
    ).toThrow(DatabaseConfigError);
  });

  it("rejects an out-of-range pool size", () => {
    expect(() =>
      parseDatabaseEnv({ ...VALID_ENV, DATABASE_POOL_MAX: "0" })
    ).toThrow(DatabaseConfigError);
    expect(() =>
      parseDatabaseEnv({ ...VALID_ENV, DATABASE_POOL_MAX: "9999" })
    ).toThrow(DatabaseConfigError);
  });
});
