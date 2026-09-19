import { describe, expect, it } from "vitest";

import { DatabaseConfigError, parseDatabaseEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgres://user:pass@pooler.example.com:5432/app",
  DATABASE_URL_UNPOOLED: "postgres://user:pass@direct.example.com:5432/app",
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

  it("rejects an identical runtime and migration URL", () => {
    expect(() =>
      parseDatabaseEnv({
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        DATABASE_URL_UNPOOLED: VALID_ENV.DATABASE_URL,
      })
    ).toThrow(DatabaseConfigError);
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
