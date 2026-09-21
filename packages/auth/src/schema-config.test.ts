import {
  loginAccount,
  rateLimit,
  session,
  user,
  verification,
} from "@relanmo/database/schema/auth";
import { type DBFieldAttribute, getSchema } from "better-auth/db";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  authSchemaConfig,
  authSchemaGeneratorVersions,
  authSchemaTableNames,
} from "./schema-config";

type AuthTable = Parameters<typeof getTableConfig>[0];

const committedTables = [user, session, loginAccount, verification, rateLimit];

function snakeCase(value: string) {
  return (
    value.match(/[\p{Ll}\d]+|\p{Lu}+(?!\p{Ll})|\p{Lu}[\p{Ll}\d]+|\p{Lo}+/gu) ??
    []
  )
    .map((word) => word.toLowerCase())
    .join("_");
}

function fieldType(field: DBFieldAttribute) {
  if (Array.isArray(field.type)) {
    return "text";
  }
  if (field.type === "string[]") {
    return "text[]";
  }
  if (field.type === "number[]") {
    return field.bigint ? "bigint[]" : "integer[]";
  }
  const types = {
    boolean: "boolean",
    date: "timestamp",
    json: "jsonb",
    number: field.bigint ? "bigint" : "integer",
    string: "text",
  } as const;
  return types[field.type];
}

function hasDatabaseDefault(field: DBFieldAttribute) {
  if (field.defaultValue === null || field.defaultValue === undefined) {
    return false;
  }
  return (
    typeof field.defaultValue !== "function" ||
    (field.type === "date" &&
      field.defaultValue.toString().includes("new Date()"))
  );
}

function sorted<T>(values: T[]) {
  return values.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function normalizeGeneratedSchema() {
  return sorted(
    Object.entries(getSchema(authSchemaConfig)).map(([modelName, table]) => ({
      columns: sorted([
        {
          databaseDefault: false,
          hasDefault: false,
          name: "id",
          notNull: true,
          onUpdate: false,
          primary: true,
          type: "text",
          unique: false,
        },
        ...Object.entries(table.fields).map(([fieldName, field]) => {
          const databaseDefault = hasDatabaseDefault(field);
          const onUpdate = Boolean(field.onUpdate && field.type === "date");
          return {
            databaseDefault,
            hasDefault: databaseDefault || onUpdate,
            name: snakeCase(field.fieldName ?? fieldName),
            notNull: field.required !== false,
            onUpdate,
            primary: false,
            type: fieldType(field),
            unique: field.unique === true,
          };
        }),
      ]),
      foreignKeys: sorted(
        Object.entries(table.fields).flatMap(([fieldName, field]) =>
          field.references
            ? [
                {
                  column: snakeCase(field.fieldName ?? fieldName),
                  foreignColumn: snakeCase(field.references.field),
                  foreignTable: snakeCase(field.references.model),
                  onDelete: field.references.onDelete ?? "cascade",
                },
              ]
            : []
        )
      ),
      indexes: sorted([
        ...Object.entries(table.fields).flatMap(([fieldName, field]) =>
          field.index
            ? [
                {
                  columns: [snakeCase(field.fieldName ?? fieldName)],
                  unique: false,
                },
              ]
            : []
        ),
        ...(table.indexes ?? []).map((index) => ({
          columns: [...index.columns].map(snakeCase),
          unique: index.unique === true,
        })),
      ]),
      name: snakeCase(modelName),
    }))
  );
}

function normalizeCommittedTable(table: AuthTable) {
  const config = getTableConfig(table);
  return {
    columns: sorted(
      config.columns.map((column) => ({
        databaseDefault: column.default !== undefined,
        hasDefault: column.hasDefault,
        name: column.name,
        notNull: column.notNull,
        onUpdate: typeof column.onUpdateFn === "function",
        primary: column.primary,
        type: column.getSQLType(),
        unique: column.isUnique,
      }))
    ),
    foreignKeys: sorted(
      config.foreignKeys.flatMap((foreignKey) => {
        const reference = foreignKey.reference();
        return reference.columns.map((column, index) => ({
          column: column.name,
          foreignColumn: reference.foreignColumns[index]?.name,
          foreignTable: getTableConfig(reference.foreignTable).name,
          onDelete: foreignKey.onDelete ?? "no action",
        }));
      })
    ),
    indexes: sorted(
      config.indexes.map((index) => ({
        columns: index.config.columns.map((column) => {
          if (!("name" in column)) {
            throw new TypeError("Auth schema indexes must use columns");
          }
          return column.name;
        }),
        unique: index.config.unique,
      }))
    ),
    name: config.name,
  };
}

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

  it("matches the generated tables, fields, constraints, references, and indexes", () => {
    expect(sorted(committedTables.map(normalizeCommittedTable))).toEqual(
      normalizeGeneratedSchema()
    );
  });
});
