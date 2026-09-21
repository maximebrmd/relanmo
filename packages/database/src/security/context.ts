/* oxlint-disable anti-slop/no-unknown-parameters -- Trusted SQL minting is the untrusted-input boundary for tenant and auth-pre-session database context. */

import { parseTenantId, parseUserId } from "@relanmo/domain/contracts";
import type { UserId } from "@relanmo/domain/contracts";
import type { TenantTransactionScope } from "@relanmo/domain/ports/persistence";

import { TENANT_CONTEXT_GUC } from "../transactions/context";
import { UntrustedSqlAccessError } from "./errors";

export const ACCESS_MODE_AUTH_PRE_SESSION = "auth_pre_session" as const;
export const ACCESS_MODE_GUC = "app.access_mode" as const;
export const ACCESS_MODE_TENANT = "tenant" as const;
export const AUTH_PRE_SESSION_USER_GUC = "app.user_id" as const;

const trustedSqlAccessBrand: unique symbol = Symbol("relanmo.trustedSqlAccess");

interface TrustedSqlAccessBrand {
  readonly [trustedSqlAccessBrand]: true;
}

export type TenantSqlAccess = TrustedSqlAccessBrand &
  Readonly<{
    kind: "tenant";
    scope: TenantTransactionScope;
  }>;

export type AuthPreSessionSqlAccess = TrustedSqlAccessBrand &
  Readonly<{
    kind: "auth_pre_session";
    userId: UserId | null;
  }>;

export type TrustedSqlAccess = AuthPreSessionSqlAccess | TenantSqlAccess;

export type TrustedSqlSession = Readonly<{
  query: (
    queryText: string,
    values?: readonly string[]
  ) => Promise<{ readonly rowCount?: number | null }>;
}>;

export type TrustedSqlClient = TrustedSqlSession &
  Readonly<{
    release: () => void;
  }>;

export type TrustedSqlPool = Readonly<{
  connect: () => Promise<TrustedSqlClient>;
}>;

export type AuthPreSessionInput = Readonly<{
  userId: UserId | null;
}>;

function requireMemberPrincipal(scope: TenantTransactionScope): UserId {
  const { principal } = scope;
  if (principal.kind === "MEMBER") {
    return parseUserId(principal.userId);
  }
  throw new UntrustedSqlAccessError(
    "member tenant SQL access requires a member principal"
  );
}

async function setLocalConfig(
  session: TrustedSqlSession,
  name: string,
  value: string
): Promise<void> {
  await session.query("select set_config($1, $2, true)", [name, value]);
}

export async function mintTrustedTenantAccess(
  pool: TrustedSqlPool,
  scope: TenantTransactionScope
): Promise<TenantSqlAccess> {
  const userId = requireMemberPrincipal(scope);
  const tenantId = parseTenantId(scope.tenantId);
  const session = await pool.connect();
  try {
    await session.query("begin");
    try {
      await setLocalConfig(session, TENANT_CONTEXT_GUC, "");
      await setLocalConfig(
        session,
        ACCESS_MODE_GUC,
        ACCESS_MODE_AUTH_PRE_SESSION
      );
      await setLocalConfig(session, AUTH_PRE_SESSION_USER_GUC, userId);
      const membership = await session.query(
        `select 1
           from memberships
          where tenant_id = $1
            and user_id = $2
            and status = 'ACTIVE'
          limit 1`,
        [tenantId, userId]
      );
      if (membership.rowCount !== 1) {
        throw new UntrustedSqlAccessError(
          "active membership is required for tenant SQL access"
        );
      }
      const trustedScope: TenantTransactionScope = {
        principal: { kind: "MEMBER", userId },
        requestId: scope.requestId,
        tenantId,
      };
      const access: TenantSqlAccess = {
        [trustedSqlAccessBrand]: true,
        kind: "tenant",
        scope: trustedScope,
      };
      await session.query("commit");
      return access;
    } catch (error) {
      await session.query("rollback");
      throw error;
    }
  } finally {
    session.release();
  }
}

export function mintTrustedWorkerAccess(
  scope: TenantTransactionScope
): TenantSqlAccess {
  if (scope.principal.kind !== "WORKER") {
    throw new UntrustedSqlAccessError(
      "worker tenant SQL access requires a worker principal"
    );
  }
  const trustedScope: TenantTransactionScope = {
    principal: {
      kind: "WORKER",
      workerId: scope.principal.workerId,
    },
    requestId: scope.requestId,
    tenantId: parseTenantId(scope.tenantId),
  };
  return {
    [trustedSqlAccessBrand]: true,
    kind: "tenant",
    scope: trustedScope,
  };
}

export function requireTrustedTenantAccess(
  access: TenantSqlAccess
): TenantTransactionScope {
  if (access[trustedSqlAccessBrand] !== true || access.kind !== "tenant") {
    throw new UntrustedSqlAccessError();
  }
  return access.scope;
}

export function mintAuthPreSessionAccess(
  input: AuthPreSessionInput
): AuthPreSessionSqlAccess {
  const userId = input.userId === null ? null : parseUserId(input.userId);
  return {
    [trustedSqlAccessBrand]: true,
    kind: "auth_pre_session",
    userId,
  };
}

export async function applyTrustedSqlContext(
  session: TrustedSqlSession,
  access: TrustedSqlAccess
): Promise<void> {
  if (access[trustedSqlAccessBrand] !== true) {
    throw new UntrustedSqlAccessError();
  }
  if (access.kind === "tenant") {
    await setLocalConfig(session, TENANT_CONTEXT_GUC, access.scope.tenantId);
    await setLocalConfig(session, ACCESS_MODE_GUC, ACCESS_MODE_TENANT);
    await setLocalConfig(
      session,
      AUTH_PRE_SESSION_USER_GUC,
      access.scope.principal.kind === "MEMBER"
        ? access.scope.principal.userId
        : ""
    );
    return;
  }
  await setLocalConfig(session, TENANT_CONTEXT_GUC, "");
  await setLocalConfig(session, ACCESS_MODE_GUC, ACCESS_MODE_AUTH_PRE_SESSION);
  await setLocalConfig(session, AUTH_PRE_SESSION_USER_GUC, access.userId ?? "");
}
