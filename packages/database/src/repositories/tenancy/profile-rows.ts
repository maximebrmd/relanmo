import type { TenantId } from "@relanmo/domain/contracts";
import type { PersistenceTransaction } from "@relanmo/domain/ports/persistence";
import { and, eq } from "drizzle-orm";

import { freelancerProfiles } from "../../schema/tenancy";
import { resolveTransactionExecutor } from "../../transactions/registry";
import type { ProfileRow } from "./mapping";

export async function loadCurrentProfile(
  tx: PersistenceTransaction,
  tenantId: TenantId,
  lock: boolean
): Promise<ProfileRow | null> {
  const db = resolveTransactionExecutor(tx);
  const query = db
    .select()
    .from(freelancerProfiles)
    .where(
      and(
        eq(freelancerProfiles.tenantId, tenantId),
        eq(freelancerProfiles.isCurrent, true)
      )
    )
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  return rows[0] ?? null;
}
