export {
  ACCESS_MODE_AUTH_PRE_SESSION,
  ACCESS_MODE_GUC,
  ACCESS_MODE_TENANT,
  AUTH_PRE_SESSION_USER_GUC,
  applyTrustedSqlContext,
  mintAuthPreSessionAccess,
  mintTrustedTenantAccess,
  mintTrustedWorkerAccess,
  requireTrustedTenantAccess,
} from "./context";
export type {
  AuthPreSessionInput,
  AuthPreSessionSqlAccess,
  TenantSqlAccess,
  TrustedSqlAccess,
  TrustedSqlSession,
} from "./context";
export { UntrustedSqlAccessError } from "./errors";
export {
  AUTH_DATABASE_ROLE,
  AUTH_SECRET_TABLES,
  RUNTIME_DATABASE_ROLES,
} from "./roles";
export type { RuntimeDatabaseRole } from "./roles";

export const databaseSecuritySurface = "node-portable-server" as const;
