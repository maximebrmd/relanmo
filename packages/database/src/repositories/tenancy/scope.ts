import type { TenantId, UserId } from "@relanmo/domain/contracts";
import type {
  PersistenceFailure,
  PersistenceTransaction,
} from "@relanmo/domain/ports/persistence";
import { TENANT_SCOPE_MISMATCH_ERROR } from "@relanmo/domain/ports/persistence";

export function tenantScopeMismatch(
  tenantId: TenantId,
  tx: PersistenceTransaction
): PersistenceFailure | null {
  if (tenantId !== tx.scope.tenantId) {
    return { error: TENANT_SCOPE_MISMATCH_ERROR, ok: false };
  }
  return null;
}

export type MemberPrincipal = PersistenceFailure | Readonly<{ userId: UserId }>;

export function memberPrincipalOrForbidden(
  tx: PersistenceTransaction
): MemberPrincipal {
  if (tx.scope.principal.kind !== "MEMBER") {
    return {
      error: {
        code: "FORBIDDEN",
        detail: "profile revisions require an active member principal",
        retryable: false,
      },
      ok: false,
    };
  }
  return { userId: tx.scope.principal.userId };
}
