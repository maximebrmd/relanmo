import { getTableConfig } from "drizzle-orm/pg-core";
import { expect } from "vitest";

export function expectTimezoneAwareInstants(
  table: Parameters<typeof getTableConfig>[0],
  columns: readonly string[]
) {
  const instants = getTableConfig(table).columns.filter((column) =>
    column.getSQLType().startsWith("timestamp")
  );
  expect(new Set(instants.map((column) => column.name))).toEqual(
    new Set(columns)
  );
  for (const column of instants) {
    expect(column.getSQLType()).toBe("timestamp with time zone");
  }
}
