import type {
  Action,
  ActionFailureReason,
  ActionIdentity,
  ActionLifecycleEvent,
  ActionPayload,
  ActionUnknownReason,
} from "../../contracts/action";
import type {
  AccountId,
  ActionId,
  CampaignId,
  SendAttemptId,
  TenantId,
} from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type { DraftSourceVersions } from "../../contracts/versions";
import type {
  AccountLeaseId,
  AccountProspectKey,
  ActionEventId,
  CurrentVersionGuard,
  PersistenceResult,
  PersistenceTransaction,
  PersistenceWorkerId,
  QuotaReservationId,
  SendReceiptId,
} from "./common";

export type StableActionIdentity = Readonly<
  Pick<
    ActionIdentity,
    | "accountId"
    | "campaignId"
    | "campaignVersionId"
    | "prospectId"
    | "step"
    | "tenantId"
  >
>;

/** The step key is stable across campaign versions for completed-step checks. */
export type ActionStepKey = Readonly<
  Pick<
    ActionIdentity,
    "accountId" | "campaignId" | "prospectId" | "step" | "tenantId"
  >
>;

export type ActionRecord = Action;
export type ConfirmedActionRecord = Extract<
  ActionRecord,
  { state: "CONFIRMED" }
>;

export type GetActionInput = Readonly<{
  actionId: ActionId;
  tenantId: TenantId;
}>;

export type GetActionResult = Readonly<{
  action: ActionRecord | null;
}>;

export type GetActionByIdentityInput = StableActionIdentity;

export type GetActionByIdentityResult = Readonly<{
  action: ActionRecord | null;
}>;

export type GetActionByStepInput = ActionStepKey;

export type GetActionByStepResult = Readonly<{
  action: ActionRecord | null;
}>;

export type GetActionEventsInput = Readonly<{
  actionId: ActionId;
  tenantId: TenantId;
}>;

export type GetActionEventsResult = Readonly<{
  events: readonly ActionEventRecord[];
}>;

export const ACTION_INVALIDATION_REASONS = [
  "INCOMING_MESSAGE",
  "MANUAL_TAKEOVER",
  "CAMPAIGN_PAUSED",
  "ACCOUNT_UNAVAILABLE",
  "ENTITLEMENT_UNAVAILABLE",
] as const;
export type ActionInvalidationReason =
  (typeof ACTION_INVALIDATION_REASONS)[number];

export type ActionInvalidationRecord = Readonly<
  AccountProspectKey & {
    actionId: ActionId;
    invalidatedAt: UtcTimestamp;
    reason: ActionInvalidationReason;
  }
>;

export type InvalidateReadyActionsInput = Readonly<
  AccountProspectKey & {
    invalidatedAt: UtcTimestamp;
    reason: ActionInvalidationReason;
  }
>;

export type InvalidateReadyActionsResult = Readonly<{
  invalidated: readonly ActionInvalidationRecord[];
}>;

export type CreateActionInput = Readonly<{
  action: ActionIdentity;
}>;

export type CreateActionResult =
  | Readonly<{
      action: ActionRecord;
      outcome: "CREATED";
    }>
  | Readonly<{
      action: ActionRecord;
      outcome: "ALREADY_EXISTS";
    }>
  | Readonly<{
      existingAction: ActionRecord;
      outcome: "IDENTITY_CONFLICT";
    }>
  | Readonly<{
      attemptedAction: ActionIdentity;
      existingAction: ActionRecord;
      outcome: "IMMUTABLE_CONFLICT";
    }>;

export type ListUnknownActionsInput = Readonly<
  AccountProspectKey & {
    limit: number;
  }
>;

export type ListUnknownActionsResult = Readonly<{
  actions: readonly ActionRecord[];
  nextCursor: string | null;
}>;

export type SendAttemptRecord = Readonly<{
  accountId: AccountId;
  actionId: ActionId;
  attemptId: SendAttemptId;
  authorizedAt: UtcTimestamp;
  fence: number;
  leaseExpiresAt: UtcTimestamp;
  payload: ActionPayload;
  requestId: string;
  sourceVersions: DraftSourceVersions;
  quotaReservationId: QuotaReservationId;
  tenantId: TenantId;
  workerId: PersistenceWorkerId;
}>;

export type SendReceiptRecord = Readonly<{
  actionId: ActionId;
  attemptId: SendAttemptId;
  completedAt: UtcTimestamp;
  failureReason: ActionFailureReason | null;
  providerMessageId: string | null;
  receiptId: SendReceiptId;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
  unknownReason: ActionUnknownReason | null;
}>;

export type ActionEventRecord = Readonly<{
  actionId: ActionId;
  event: ActionLifecycleEvent;
  eventId: ActionEventId;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type GetAttemptInput = Readonly<{
  attemptId: SendAttemptId;
  tenantId: TenantId;
}>;

export type GetAttemptResult = Readonly<{
  attempt: SendAttemptRecord | null;
  receipt: SendReceiptRecord | null;
}>;

export type RecordSendOutcomeInput = Readonly<
  AccountProspectKey &
    (
      | {
          actionId: ActionId;
          attemptId: SendAttemptId;
          completedAt: UtcTimestamp;
          fence: number;
          outcome: "CONFIRMED";
          providerMessageId: string;
          receiptId: SendReceiptId;
          recordedAt: UtcTimestamp;
        }
      | {
          actionId: ActionId;
          attemptId: SendAttemptId;
          completedAt: UtcTimestamp;
          fence: number;
          failureReason: ActionFailureReason;
          outcome: "FAILED";
          providerMessageId: null;
          receiptId: SendReceiptId;
          recordedAt: UtcTimestamp;
        }
      | {
          actionId: ActionId;
          attemptId: SendAttemptId;
          completedAt: UtcTimestamp;
          fence: number;
          outcome: "UNKNOWN";
          providerMessageId: null;
          receiptId: SendReceiptId;
          recordedAt: UtcTimestamp;
          unknownReason: ActionUnknownReason;
        }
    )
>;

export type RecordSendOutcomeResult =
  | Readonly<{
      action: ActionRecord;
      outcome: "RECORDED";
      receipt: SendReceiptRecord;
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      action: ActionRecord;
      existingReceipt: SendReceiptRecord;
      outcome: "ALREADY_RECORDED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      action: ActionRecord;
      existingReceipt: SendReceiptRecord;
      outcome: "CONFLICTING_RECEIPT";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      action: ActionRecord;
      outcome: "STALE_FENCE";
      reservation: QuotaReservationRecord;
    }>;

/**
 * Actions have immutable identity and append-only attempts/receipts/events.
 * The current Action lifecycle is a projection updated only by guarded methods.
 * `IMMUTABLE_CONFLICT` means the same action ID was presented with different
 * payload or source-version data; it must never overwrite the existing row.
 */
export interface ActionRepository {
  create: (
    input: CreateActionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<CreateActionResult>>;
  get: (
    input: GetActionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetActionResult>>;
  getAttempt: (
    input: GetAttemptInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetAttemptResult>>;
  getByIdentity: (
    input: GetActionByIdentityInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetActionByIdentityResult>>;
  getByStep: (
    input: GetActionByStepInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetActionByStepResult>>;
  getEvents: (
    input: GetActionEventsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetActionEventsResult>>;
  invalidateReady: (
    input: InvalidateReadyActionsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<InvalidateReadyActionsResult>>;
  listUnknown: (
    input: ListUnknownActionsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListUnknownActionsResult>>;
  recordOutcome: (
    input: RecordSendOutcomeInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordSendOutcomeResult>>;
  markExpiredUnknown: (
    input: MarkExpiredUnknownInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<MarkExpiredUnknownResult>>;
}

export type MarkExpiredUnknownInput = Readonly<{
  actionId: ActionId;
  attemptId: SendAttemptId;
  fence: number;
  observedAt: UtcTimestamp;
  tenantId: TenantId;
  unknownReason: Extract<ActionUnknownReason, "LEASE_EXPIRED" | "TIMEOUT">;
}>;

export type MarkExpiredUnknownResult =
  | Readonly<{
      action: ActionRecord;
      outcome: "MARKED_UNKNOWN" | "ALREADY_UNKNOWN";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      action: ActionRecord;
      outcome: "ALREADY_SETTLED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      action: ActionRecord;
      outcome: "FENCE_MISMATCH";
      reservation: QuotaReservationRecord;
    }>;

export type AccountLeaseRecord = Readonly<{
  accountId: AccountId;
  acquiredAt: UtcTimestamp;
  expiresAt: UtcTimestamp;
  fence: number;
  leaseId: AccountLeaseId;
  owner: PersistenceWorkerId;
  tenantId: TenantId;
}>;

/** A fence is strictly monotonic per tenant/account and never resets. */
export const ACCOUNT_LEASE_FENCE_POLICY = {
  monotonicPerAccount: true,
  resetOnExpiry: false,
  resetOnRelease: false,
} as const;

export type AcquireAccountLeaseInput = Readonly<{
  accountId: AccountId;
  expiresAt: UtcTimestamp;
  owner: PersistenceWorkerId;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type AcquireAccountLeaseResult =
  | Readonly<{
      lease: AccountLeaseRecord;
      outcome: "ACQUIRED";
    }>
  | Readonly<{
      current: AccountLeaseRecord;
      outcome: "HELD_BY_OTHER";
    }>;

export type RenewAccountLeaseInput = Readonly<{
  accountId: AccountId;
  expiresAt: UtcTimestamp;
  fence: number;
  leaseId: AccountLeaseId;
  owner: PersistenceWorkerId;
  tenantId: TenantId;
}>;

export type RenewAccountLeaseResult =
  | Readonly<{
      lease: AccountLeaseRecord;
      outcome: "RENEWED";
    }>
  | Readonly<{
      current: AccountLeaseRecord | null;
      outcome: "FENCE_MISMATCH";
    }>;

export type ReleaseAccountLeaseInput = Readonly<{
  accountId: AccountId;
  fence: number;
  leaseId: AccountLeaseId;
  owner: PersistenceWorkerId;
  tenantId: TenantId;
}>;

export type ReleaseAccountLeaseResult = Readonly<{
  outcome: "RELEASED" | "FENCE_MISMATCH" | "ALREADY_RELEASED";
}>;

export interface AccountLeaseRepository {
  acquire: (
    input: AcquireAccountLeaseInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AcquireAccountLeaseResult>>;
  release: (
    input: ReleaseAccountLeaseInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ReleaseAccountLeaseResult>>;
  renew: (
    input: RenewAccountLeaseInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RenewAccountLeaseResult>>;
}

export const QUOTA_BUCKETS = ["INVITATIONS", "MESSAGES"] as const;
export type QuotaBucket = (typeof QUOTA_BUCKETS)[number];

export const QUOTA_RESERVATION_STATES = [
  "HELD",
  "CONSUMED",
  "RELEASED",
  "RETAINED_UNKNOWN",
] as const;
export type QuotaReservationState = (typeof QUOTA_RESERVATION_STATES)[number];

export type QuotaReservationRecord = Readonly<{
  accountId: AccountId;
  actionId: ActionId;
  bucket: QuotaBucket;
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  fence: number;
  periodEnd: UtcTimestamp;
  periodStart: UtcTimestamp;
  reservationId: QuotaReservationId;
  state: QuotaReservationState;
  tenantId: TenantId;
  units: number;
  updatedAt: UtcTimestamp;
}>;

export type ReserveQuotaInput = Readonly<{
  accountId: AccountId;
  actionId: ActionId;
  bucket: QuotaBucket;
  campaignId: CampaignId;
  fence: number;
  periodEnd: UtcTimestamp;
  periodStart: UtcTimestamp;
  reservationId: QuotaReservationId;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
  units: number;
}>;

export type ReserveQuotaResult =
  | Readonly<{
      outcome: "RESERVED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      availableUnits: number;
      outcome: "UNAVAILABLE";
      requestedUnits: number;
    }>;

export type SettleQuotaInput = Readonly<{
  actionId: ActionId;
  fence: number;
  reservationId: QuotaReservationId;
  settledAt: UtcTimestamp;
  tenantId: TenantId;
  settlement: "CONFIRMED" | "DEFINITIVE_FAILURE" | "UNKNOWN";
}>;

export type SettleQuotaResult =
  | Readonly<{
      outcome: "CONSUMED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      outcome: "RELEASED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      outcome: "RETAINED_UNKNOWN";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      outcome: "ALREADY_SETTLED";
      reservation: QuotaReservationRecord;
    }>
  | Readonly<{
      outcome: "FENCE_MISMATCH";
      reservation: QuotaReservationRecord;
    }>;

/** Settlement may mutate a reservation only when its lease fence still owns it. */

export interface QuotaRepository {
  reserve: (
    input: ReserveQuotaInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ReserveQuotaResult>>;
  settle: (
    input: SettleQuotaInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SettleQuotaResult>>;
}

export const SEND_AUTHORIZATION_DENIAL_REASONS = [
  "ACTION_NOT_READY",
  "ACCOUNT_UNHEALTHY",
  "CAMPAIGN_INACTIVE",
  "ENTITLEMENT_UNAVAILABLE",
  "HUMAN_OWNED",
  "INCOMING_MESSAGE",
  "LEASE_UNAVAILABLE",
  "NOT_DUE",
  "OUTSIDE_SEND_WINDOW",
  "QUOTA_UNAVAILABLE",
  "RECONCILIATION_REQUIRED",
  "STALE_VERSION",
  "SUPPRESSED",
  "UNKNOWN_SEND",
] as const;
export type SendAuthorizationDenialReason =
  (typeof SEND_AUTHORIZATION_DENIAL_REASONS)[number];

export type AuthorizeSendInput = Readonly<
  AccountProspectKey & {
    actionId: ActionId;
    attemptId: SendAttemptId;
    currentVersions: CurrentVersionGuard;
    leaseExpiresAt: UtcTimestamp;
    quota: Readonly<{
      bucket: QuotaBucket;
      periodEnd: UtcTimestamp;
      periodStart: UtcTimestamp;
      reservationId: QuotaReservationId;
      units: number;
    }>;
    requestedAt: UtcTimestamp;
    requestId: string;
    workerId: PersistenceWorkerId;
  }
>;

export type AuthorizedSend = Readonly<{
  action: ActionRecord;
  attempt: SendAttemptRecord;
  lease: AccountLeaseRecord;
  reservation: QuotaReservationRecord;
}>;

export type AuthorizeSendResult =
  | Readonly<{
      authorized: AuthorizedSend;
      outcome: "AUTHORIZED";
    }>
  | Readonly<{
      action: ActionRecord | null;
      observedAt: UtcTimestamp;
      outcome: "DENIED";
      reason: SendAuthorizationDenialReason;
    }>
  | Readonly<{
      action: ActionRecord;
      attempt: SendAttemptRecord;
      outcome: "ALREADY_IN_FLIGHT";
    }>;

/** `ALREADY_IN_FLIGHT` is not new send permission for a second worker. */

/**
 * This is the sole send gate. In one transaction it locks entitlement, account,
 * pair ownership, campaign/style version rows, then action/reservation rows;
 * re-reads every authoritative control, transitions READY to IN_FLIGHT and
 * creates the attempt, account fence and quota reservation together. A reply
 * stop committed first makes this operation deny. A prior authorization may
 * still complete because the provider is outside our transaction.
 */
export interface AtomicSendAuthorizationRepository {
  authorize: (
    input: AuthorizeSendInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AuthorizeSendResult>>;
}
