import type {
  AccountId,
  Brand,
  ProspectId,
  TenantId,
  UserId,
} from "../../contracts/ids";
import type { CurrentVersionSet } from "../../contracts/versions";

/** IDs for rows that are owned by the persistence boundary rather than a provider. */
export type PersistenceRecordId<Kind extends string> = Brand<
  string,
  `Persistence${Kind}Id`
>;

export type MembershipId = PersistenceRecordId<"Membership">;
export type ConnectionAttemptId = PersistenceRecordId<"ConnectionAttempt">;
export type AccountLeaseId = PersistenceRecordId<"AccountLease">;
export type QuotaReservationId = PersistenceRecordId<"QuotaReservation">;
export type SendReceiptId = PersistenceRecordId<"SendReceipt">;
export type ActionEventId = PersistenceRecordId<"ActionEvent">;
export type InboxEventId = PersistenceRecordId<"InboxEvent">;
export type BillingEventId = PersistenceRecordId<"BillingEvent">;
export type UsageEventId = PersistenceRecordId<"UsageEvent">;
export type AuditEventId = PersistenceRecordId<"AuditEvent">;
export type ImportRunId = PersistenceRecordId<"ImportRun">;

export const PERSISTENCE_ERROR_CODES = [
  "VALIDATION",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RETRYABLE",
  "UNAVAILABLE",
  "INTEGRITY",
  "LEASE_LOST",
] as const;
export type PersistenceErrorCode = (typeof PERSISTENCE_ERROR_CODES)[number];

export type PersistenceError = Readonly<{
  code: PersistenceErrorCode;
  detail: string | null;
  retryable: boolean;
}>;

export type PersistenceSuccess<Value> = Readonly<{
  ok: true;
  value: Value;
}>;

export type PersistenceFailure = Readonly<{
  error: PersistenceError;
  ok: false;
}>;

/** Repository methods return data-or-error values; transaction failures are never hidden. */
export type PersistenceResult<Value> =
  | PersistenceFailure
  | PersistenceSuccess<Value>;

export type PersistenceWorkerId = Brand<string, "PersistenceWorkerId">;

export type PersistencePrincipal =
  | Readonly<{
      kind: "MEMBER";
      userId: UserId;
    }>
  | Readonly<{
      kind: "WORKER";
      workerId: PersistenceWorkerId;
    }>;

/** Membership and RLS scope is established before a transaction is opened. */
export type TenantTransactionScope = Readonly<{
  principal: PersistencePrincipal;
  requestId: string | null;
  tenantId: TenantId;
}>;

export const PERSISTENCE_ISOLATION_LEVELS = [
  "READ_COMMITTED",
  "REPEATABLE_READ",
  "SERIALIZABLE",
] as const;
export type PersistenceIsolationLevel =
  (typeof PERSISTENCE_ISOLATION_LEVELS)[number];

export type PersistenceConnectionId = Brand<string, "PersistenceConnectionId">;

declare const persistenceTransactionBrand: unique symbol;

/**
 * Deliberately narrow context for one checked-out database connection.
 *
 * Repositories accept this value instead of a pool or a second client. The
 * implementation owns the brand and must keep the same connection until the
 * transaction runner commits or rolls back. Network/provider calls are not
 * represented here and must happen outside this transaction.
 */
export interface PersistenceTransaction {
  readonly [persistenceTransactionBrand]: "single-connection";
  readonly connectionId: PersistenceConnectionId;
  readonly isolationLevel: PersistenceIsolationLevel;
  readonly scope: TenantTransactionScope;
}

export type PersistenceTransactionWork<Value> = (
  tx: PersistenceTransaction
) => Promise<PersistenceResult<Value>>;

/**
 * The only boundary that may create a PersistenceTransaction. A false result
 * or thrown database error must roll back; only an `ok: true` work result may
 * commit.
 */
export interface PersistenceTransactionRunner {
  run: <Value>(
    input: Readonly<{
      isolationLevel?: PersistenceIsolationLevel;
      scope: TenantTransactionScope;
      work: PersistenceTransactionWork<Value>;
    }>
  ) => Promise<PersistenceResult<Value>>;
}

/**
 * Every multi-row operation takes the subset of this order that it needs.
 * Keeping the order here prevents reply-stop and send authorization from
 * acquiring the same rows in opposite orders across worker replicas.
 */
export const PERSISTENCE_LOCK_ORDER = [
  "ENTITLEMENT",
  "ACCOUNT",
  "PAIR_OWNERSHIP",
  "CAMPAIGN_VERSIONS",
  "STYLE_VERSIONS",
  "ACTION_RESERVATIONS",
] as const;
export type PersistenceLockName = (typeof PERSISTENCE_LOCK_ORDER)[number];

export type AccountProspectKey = Readonly<{
  accountId: AccountId;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

/**
 * Shared optimistic guard. Campaign/style mutations and send authorization
 * compare the same current-version snapshot; a revision update without this
 * guard is not a valid mutation.
 */
export type CurrentVersionGuard = Readonly<{
  expected: CurrentVersionSet;
}>;

/** Future database tasks implement each family only in its assigned directory. */
export const PERSISTENCE_IMPLEMENTATION_DIRECTORIES = {
  account: "packages/database/src/repositories/account-control/",
  action: "packages/database/src/repositories/actions/",
  billing: "packages/database/src/repositories/billing/",
  campaign: "packages/database/src/repositories/campaigns/",
  conversation: "packages/database/src/repositories/conversations/",
  event: "packages/database/src/repositories/events/",
  import: "packages/database/src/repositories/imports/",
  profile: "packages/database/src/repositories/tenancy/",
  prospect: "packages/database/src/repositories/prospects/",
  replyStop: "packages/database/src/repositories/reply-stop/",
  style: "packages/database/src/repositories/styles/",
  tenant: "packages/database/src/repositories/tenancy/",
  usage: "packages/database/src/repositories/usage/",
} as const;

export type RevisionConflict = Readonly<{
  actual: CurrentVersionSet;
  expected: CurrentVersionSet;
  outcome: "REVISION_CONFLICT";
}>;

export type RevisionMutationResult<Value> =
  | Readonly<{
      outcome: "UPDATED";
      value: Value;
    }>
  | RevisionConflict;

/** Unknown external outcomes retain their reservation and cannot be retried blindly. */
export const UNKNOWN_OUTCOME_POLICY = {
  releaseQuota: false,
  retryWithoutReconciliation: false,
  retainActionHold: true,
} as const;
