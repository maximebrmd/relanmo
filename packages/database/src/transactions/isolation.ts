import type { PersistenceIsolationLevel } from "@relanmo/domain/ports/persistence";

export type PgIsolationLevel =
  | "read committed"
  | "read uncommitted"
  | "repeatable read"
  | "serializable";

const ISOLATION_LEVEL_MAP: Record<PersistenceIsolationLevel, PgIsolationLevel> =
  {
    READ_COMMITTED: "read committed",
    REPEATABLE_READ: "repeatable read",
    SERIALIZABLE: "serializable",
  };

export function mapIsolationLevel(
  level: PersistenceIsolationLevel
): PgIsolationLevel {
  return ISOLATION_LEVEL_MAP[level];
}
