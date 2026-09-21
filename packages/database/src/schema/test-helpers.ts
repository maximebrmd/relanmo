import { getTableConfig } from "drizzle-orm/pg-core";
import { expect } from "vitest";

type Table = Parameters<typeof getTableConfig>[0];

export function expectTimezoneAwareInstants(
  table: Table,
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

export function foreignKeyBindings(table: Table) {
  return getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return {
      columns: reference.columns.map((column) => column.name),
      foreignColumns: reference.foreignColumns.map((column) => column.name),
      foreignTable: getTableConfig(reference.foreignTable).name,
      onDelete: foreignKey.onDelete,
    };
  });
}

export function expectForeignKey(
  table: Table,
  column: string,
  foreignTable: string,
  foreignColumn = "id"
) {
  const match = foreignKeyBindings(table).find(
    (binding) =>
      binding.columns.length === 1 &&
      binding.columns[0] === column &&
      binding.foreignTable === foreignTable
  );
  expect(match).toBeDefined();
  expect(match?.foreignColumns).toEqual([foreignColumn]);
}
