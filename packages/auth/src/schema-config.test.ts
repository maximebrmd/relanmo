import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as committedAuthSchema from "@relanmo/database/schema/auth";
import { type DBAdapter, generateDrizzleSchema } from "auth/api";
import { is } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  One,
} from "drizzle-orm/relations";
import { describe, expect, it } from "vitest";

import {
  authSchemaConfig,
  authSchemaGeneratorVersions,
  authSchemaTableNames,
} from "./schema-config";

type AuthTable = Parameters<typeof getTableConfig>[0];

function sorted<T>(values: T[]) {
  return values.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function normalizeTable(table: AuthTable) {
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

function normalizeSchema(schema: Record<string, unknown>) {
  const relationalConfig = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers
  );
  return sorted(
    Object.values(relationalConfig.tables).map((table) => {
      const firstColumn = Object.values(table.columns)[0];
      if (!firstColumn) {
        throw new TypeError(`Auth table ${table.dbName} has no columns`);
      }
      return {
        ...normalizeTable(firstColumn.table),
        relations: sorted(
          Object.values(table.relations).map((relation) => {
            const one = is(relation, One);
            return {
              fields: one
                ? (relation.config?.fields.map((field) => field.name) ?? [])
                : [],
              kind: one ? "one" : "many",
              referencedTable: relation.referencedTableName,
              references: one
                ? (relation.config?.references.map(
                    (reference) => reference.name
                  ) ?? [])
                : [],
              relationName: relation.relationName ?? null,
            };
          })
        ),
      };
    })
  );
}

async function generateSchemaModule() {
  const directory = await mkdtemp(
    path.join(import.meta.dirname, ".auth-schema-generator-")
  );
  try {
    const file = path.join(directory, "schema.mjs");
    const adapter = {
      id: "drizzle",
      options: { provider: "pg" },
    } as DBAdapter;
    const generated = await generateDrizzleSchema({
      adapter,
      file,
      options: authSchemaConfig,
    });
    if (!generated.code) {
      throw new TypeError("Better Auth generator returned no schema module");
    }
    await writeFile(file, generated.code);
    return await import(pathToFileURL(file).href);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
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

  it("matches the pinned generator's complete Drizzle schema", async () => {
    const generatedAuthSchema = await generateSchemaModule();
    expect(normalizeSchema(committedAuthSchema)).toEqual(
      normalizeSchema(generatedAuthSchema)
    );
  });
});
