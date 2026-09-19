import type {
  PersistenceConnectionId,
  PersistenceTransaction,
} from "@relanmo/domain/ports/persistence";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";

/**
 * The query-builder surface shared by the pool-backed NodePgDatabase and
 * the NodePgTransaction handed to a `db.transaction` callback: both extend
 * this class, so a transaction value is assignable here without a cast.
 */
export type TransactionExecutor = PgDatabase<
  NodePgQueryResultHKT,
  Record<string, never>
>;

/**
 * Live executors, keyed by the connectionId of the PersistenceTransaction
 * that is currently open on them. The runner registers an entry right
 * after BEGIN and removes it as soon as the transaction settles, so a
 * `tx` value can never resolve to a connection outside its own
 * `PersistenceTransactionRunner.run` callback.
 */
const activeExecutors = new Map<PersistenceConnectionId, TransactionExecutor>();

export function registerExecutor(
  connectionId: PersistenceConnectionId,
  executor: TransactionExecutor
): void {
  activeExecutors.set(connectionId, executor);
}

export function unregisterExecutor(
  connectionId: PersistenceConnectionId
): void {
  activeExecutors.delete(connectionId);
}

/** Repository implementations use this to reach the query executor bound to `tx`. */
export function resolveTransactionExecutor(
  tx: PersistenceTransaction
): TransactionExecutor {
  const executor = activeExecutors.get(tx.connectionId);
  if (!executor) {
    throw new Error(
      "PersistenceTransaction is not active; it can only be used inside the PersistenceTransactionRunner.run callback that created it"
    );
  }
  return executor;
}
