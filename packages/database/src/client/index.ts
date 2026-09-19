export { DatabaseConfigError, parseDatabaseEnv } from "./env";
export type { DatabaseEnv } from "./env";
export {
  createDatabaseRuntimeClient,
  createMigrationClient,
  createRuntimeDrizzle,
  createRuntimePool,
} from "./connections";
export type { DatabaseRuntimeClient, RuntimeDatabase } from "./connections";

export const databaseClientSurface = "node-portable-server" as const;
