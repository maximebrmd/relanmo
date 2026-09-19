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

  it("stays within the Postgres identifier limit for a long label", () => {
    const longLabel =
      "a_really_long_descriptive_test_suite_name_used_by_a_future_call";
    const name = generateTestDatabaseName(longLabel);
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name).toMatch(/^[a-z0-9_]+$/u);
  });

  it("never collides on two calls with the same long label", () => {
    // Regression: truncating the assembled name from the end used to
    // remove the random suffix entirely once the label pushed the total
    // past 63 characters, making every call with that label identical.
    const longLabel =
      "a_really_long_descriptive_test_suite_name_used_by_a_future_call";
    const names = new Set(
      Array.from({ length: 20 }, () => generateTestDatabaseName(longLabel))
    );
    expect(names.size).toBe(20);
  });
});
