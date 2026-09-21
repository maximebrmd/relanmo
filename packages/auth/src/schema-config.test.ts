/// <reference types="node" />

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as committedAuthSchema from "@relanmo/database/schema/auth";
import { generateDrizzleSchema } from "auth/api";
import type { DBAdapter } from "auth/api";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, IndexedColumn, PgDialect } from "drizzle-orm/pg-core";
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
type DrizzleColumnDefault = ReturnType<
  typeof getTableConfig
>["columns"][number]["default"];
type DrizzleSchema = Parameters<typeof extractTablesRelationalConfig>[0];

const pgDialect = new PgDialect();
const moduleResolver = createRequire(
  path.join(process.cwd(), "packages/auth/package.json")
);
const logicalAliases = new Map([
  ["login_account", "loginAccount"],
  ["login_accounts", "loginAccounts"],
  ["login_account_userId_idx", "loginAccount_userId_idx"],
]);

function logicalName(name: string) {
  return logicalAliases.get(name) ?? name;
}

function sorted<T>(values: T[]) {
  const copiedValues = [...values];
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2022 lacks toSorted(); sorting a copy preserves the caller's array.
  return copiedValues.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function normalizeDefault(value: DrizzleColumnDefault) {
  if (value === undefined) {
    return { kind: "none" } as const;
  }
  if (is(value, SQL)) {
    const query = pgDialect.sqlToQuery(value);
    return { kind: "sql", params: query.params, sql: query.sql } as const;
  }
  return {
    kind: "value",
    value: value instanceof Date ? value.toISOString() : value,
  } as const;
}

function normalizeSql(value: SQL | undefined) {
  if (!value) {
    return null;
  }
  const query = pgDialect.sqlToQuery(value);
  return { params: query.params, sql: query.sql };
}

function normalizeTable(
  table: AuthTable,
  logicalColumns: Record<string, string>
) {
  const config = getTableConfig(table);
  return {
    columns: sorted(
      config.columns.map((column) => ({
        columnType: column.columnType,
        dataType: column.dataType,
        default: normalizeDefault(column.default),
        enumValues: column.enumValues ?? null,
        generated: column.generated ?? null,
        generatedIdentity: column.generatedIdentity ?? null,
        hasDefault: column.hasDefault,
        logicalName: logicalColumns[column.name],
        name: column.name,
        notNull: column.notNull,
        onUpdate: Boolean(column.onUpdateFn),
        primary: column.primary,
        type: column.getSQLType(),
        unique: column.isUnique,
        uniqueName: column.uniqueName,
        uniqueType: column.uniqueType ?? null,
      }))
    ),
    checks: sorted(
      config.checks.map((check) => ({
        expression: normalizeSql(check.value),
        name: check.name,
      }))
    ),
    enableRLS: config.enableRLS,
    foreignKeys: sorted(
      config.foreignKeys.map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          columns: reference.columns.map((column) => column.name),
          foreignColumns: reference.foreignColumns.map((column) => column.name),
          foreignTable: getTableConfig(reference.foreignTable).name,
          name: foreignKey.getName(),
          onDelete: foreignKey.onDelete ?? "no action",
          onUpdate: foreignKey.onUpdate ?? "no action",
        };
      })
    ),
    indexes: sorted(
      config.indexes.map((index) => ({
        columns: index.config.columns.map((column) => {
          if (is(column, SQL)) {
            return { expression: normalizeSql(column), kind: "sql" } as const;
          }
          if (is(column, IndexedColumn)) {
            return {
              indexConfig: column.indexConfig,
              kind: "column",
              name: column.name,
              type: column.type,
            } as const;
          }
          throw new TypeError("Unsupported Drizzle index column metadata");
        }),
        concurrently: index.config.concurrently === true,
        method: index.config.method ?? "btree",
        name: logicalName(index.config.name ?? ""),
        only: index.config.only,
        unique: index.config.unique,
        where: normalizeSql(index.config.where),
        with: index.config.with ?? null,
      }))
    ),
    name: config.name,
    policies: sorted(
      config.policies.map((policy) => ({
        as: policy.as ?? null,
        for: policy.for ?? null,
        name: policy.name,
        to: policy.to ?? null,
        using: normalizeSql(policy.using),
        withCheck: normalizeSql(policy.withCheck),
      }))
    ),
    primaryKeys: sorted(
      config.primaryKeys.map((primaryKey) => ({
        columns: primaryKey.columns.map((column) => column.name),
        name: primaryKey.getName(),
      }))
    ),
    schema: config.schema ?? null,
    uniqueConstraints: sorted(
      config.uniqueConstraints.map((constraint) => ({
        columns: constraint.columns.map((column) => column.name),
        name: constraint.getName(),
        nullsNotDistinct: constraint.nullsNotDistinct,
      }))
    ),
  };
}

async function installedPackageVersion(specifier: string) {
  const entry = moduleResolver.resolve(specifier);
  // SAFETY: package manifests are parsed below before their version is used.
  const manifest = JSON.parse(
    await readFile(path.join(path.dirname(entry), "../package.json"), "utf-8")
  ) as { version?: string };
  if (!manifest.version) {
    throw new TypeError(`${specifier} package has no version`);
  }
  return manifest.version;
}

function normalizeSchema(schema: DrizzleSchema) {
  const relationalConfig = extractTablesRelationalConfig(
    schema,
    createTableRelationsHelpers
  );
  return sorted(
    Object.values(relationalConfig.tables).map((table) => {
      const [firstColumn] = Object.values(table.columns);
      if (!firstColumn) {
        throw new TypeError(`Auth table ${table.dbName} has no columns`);
      }
      const logicalColumns = Object.fromEntries(
        Object.entries(table.columns).map(([key, column]) => [column.name, key])
      );
      return {
        ...normalizeTable(firstColumn.table, logicalColumns),
        logicalName: logicalName(table.tsName),
        relations: sorted(
          Object.entries(table.relations).map(([key, relation]) => {
            const one = is(relation, One);
            return {
              fields: one
                ? (relation.config?.fields.map((field) => field.name) ?? [])
                : [],
              kind: one ? "one" : "many",
              logicalName: logicalName(key),
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
  const authPackageDirectory = path.dirname(
    moduleResolver.resolve("@relanmo/auth/package.json")
  );
  const directory = await mkdtemp(
    path.join(authPackageDirectory, "src/.auth-schema-generator-")
  );
  try {
    const file = path.join(directory, "schema.mjs");
    // SAFETY: Better Auth's generator only reads this adapter's documented id,
    // provider, and file-generation fields; it does not call runtime methods.
    // @ts-expect-error -- generation does not require a runtime adapter's CRUD methods.
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

  it("pins the installed generator, runtime, and adapter releases", async () => {
    const [generator, runtime, adapter] = await Promise.all([
      installedPackageVersion("auth/api"),
      installedPackageVersion("better-auth"),
      installedPackageVersion("@better-auth/drizzle-adapter"),
    ]);
    expect({ adapter, generator, runtime }).toEqual({
      adapter: authSchemaGeneratorVersions.drizzleAdapter,
      generator: authSchemaGeneratorVersions.betterAuth,
      runtime: authSchemaGeneratorVersions.betterAuth,
    });
  });

  it("matches the pinned generator's complete Drizzle schema", async () => {
    const generatedAuthSchema = await generateSchemaModule();
    expect(normalizeSchema(committedAuthSchema)).toEqual(
      normalizeSchema(generatedAuthSchema)
    );
  });
});
