import type { TenantTransactionScope } from "@relanmo/domain/ports/persistence";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Tenant RLS policies read this per-transaction setting. It is set with
 * `set_config(..., is_local = true)`, so PostgreSQL discards it when the
 * transaction commits or rolls back; a pooled connection therefore starts
 * its next transaction with no residual tenant context.
 */
export const TENANT_CONTEXT_GUC = "app.tenant_id" as const;

type SqlExecutable = Pick<NodePgDatabase, "execute">;

export async function setTenantContext(
  tx: SqlExecutable,
  scope: TenantTransactionScope
): Promise<void> {
  await tx.execute(
    sql`select set_config(${TENANT_CONTEXT_GUC}, ${scope.tenantId}, true)`
  );
}
