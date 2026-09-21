import type {
  PersistenceTransaction,
  TenantRepository,
} from "@relanmo/domain/ports/persistence";
import { and, asc, eq, ne } from "drizzle-orm";

import { memberships, tenants } from "../../schema/tenancy";
import { resolveTransactionExecutor } from "../../transactions/registry";
import {
  catchMappingError,
  mapMembershipRecord,
  mapTenantRecord,
} from "./mapping";
import { loadCurrentVersions } from "./current-version-rows";
import { tenantScopeMismatch } from "./scope";

async function currentVersionsFor(tx: PersistenceTransaction, lock: boolean) {
  return (await loadCurrentVersions(tx, tx.scope.tenantId, lock)).current;
}

export function createTenantRepository(): TenantRepository {
  return {
    get: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const db = resolveTransactionExecutor(tx);
        const [row] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tx.scope.tenantId))
          .limit(1);
        if (!row) {
          return { ok: true, value: { tenant: null } };
        }
        return {
          ok: true,
          value: {
            tenant: mapTenantRecord(row, await currentVersionsFor(tx, false)),
          },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
    getMembership: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const db = resolveTransactionExecutor(tx);
        const [row] = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.tenantId, tx.scope.tenantId),
              eq(memberships.userId, input.userId)
            )
          )
          .limit(1);
        return {
          ok: true,
          value: { membership: row ? mapMembershipRecord(row) : null },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
    listMemberships: async (input, tx) => {
      const mismatch = tenantScopeMismatch(input.tenantId, tx);
      if (mismatch) {
        return mismatch;
      }
      try {
        const db = resolveTransactionExecutor(tx);
        const filters = [eq(memberships.tenantId, tx.scope.tenantId)];
        if (!input.includeRevoked) {
          filters.push(ne(memberships.status, "REVOKED"));
        }
        const rows = await db
          .select()
          .from(memberships)
          .where(and(...filters))
          .orderBy(asc(memberships.createdAt), asc(memberships.id));
        return {
          ok: true,
          value: { memberships: rows.map((row) => mapMembershipRecord(row)) },
        };
      } catch (error) {
        return catchMappingError(error);
      }
    },
  };
}
