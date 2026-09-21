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

export type AuthPreSessionInput = Readonly<{
  userId: UserId | null;
}>;

function requirePrincipal(scope: TenantTransactionScope): void {
  const { principal } = scope;
  if (principal.kind === "MEMBER") {
    parseUserId(principal.userId);
    return;
  }
  if (principal.kind === "WORKER") {
    return;
  }
  throw new UntrustedSqlAccessError(
    "tenant SQL access requires a member or worker principal"
  );
}

export function mintTrustedTenantAccess(
  scope: TenantTransactionScope
): TenantSqlAccess {
  requirePrincipal(scope);
  parseTenantId(scope.tenantId);
  return {
    [trustedSqlAccessBrand]: true,
    kind: "tenant",
    scope,
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

async function setLocalConfig(
  session: TrustedSqlSession,
  name: string,
  value: string
): Promise<void> {
  await session.query("select set_config($1, $2, true)", [name, value]);
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
    await setLocalConfig(session, AUTH_PRE_SESSION_USER_GUC, "");
    return;
  }
  await setLocalConfig(session, TENANT_CONTEXT_GUC, "");
  await setLocalConfig(session, ACCESS_MODE_GUC, ACCESS_MODE_AUTH_PRE_SESSION);
  await setLocalConfig(session, AUTH_PRE_SESSION_USER_GUC, access.userId ?? "");
}
