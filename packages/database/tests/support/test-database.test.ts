import { describe, expect, it } from "vitest";

import { generateTestDatabaseName } from "./test-database";

describe("generateTestDatabaseName", () => {
  it("produces a valid, bounded Postgres identifier", () => {
    const name = generateTestDatabaseName("suite");
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name).toMatch(/^[a-z0-9_]+$/u);
    expect(name).toContain("suite");
  });

  it("is unique across calls, even with the same label and process", () => {
    const names = new Set(
      Array.from({ length: 20 }, () => generateTestDatabaseName("dup"))
    );
    expect(names.size).toBe(20);
  });

  it("sanitizes a label with characters invalid for an identifier", () => {
    const name = generateTestDatabaseName("has spaces/And-Caps");
    expect(name).toMatch(/^[a-z0-9_]+$/u);
  });
});
