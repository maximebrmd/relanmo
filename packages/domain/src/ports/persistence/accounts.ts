import type { AccountId, TenantId, UserId } from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  ConnectionAttemptId,
  PersistenceResult,
  PersistenceTransaction,
} from "./common";

export const PROVIDER_ACCOUNT_STATUSES = [
  "PENDING",
  "HEALTHY",
  "DEGRADED",
  "DISCONNECTED",
  "CHALLENGE_REQUIRED",
  "DISABLED",
] as const;
export type ProviderAccountStatus = (typeof PROVIDER_ACCOUNT_STATUSES)[number];

export type AccountHealth = Readonly<{
  capabilities: readonly string[];
  lastSuccessfulReconciliationAt: UtcTimestamp | null;
  observedAt: UtcTimestamp;
  reason: string | null;
  status: ProviderAccountStatus;
}>;

export type ProviderAccountRecord = Readonly<{
  accountId: AccountId;
  createdAt: UtcTimestamp;
  health: AccountHealth;
  providerAccountId: string;
  providerUserId: string | null;
  revision: number;
  status: ProviderAccountStatus;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type ConnectionAttemptRecord = Readonly<{
  attemptId: ConnectionAttemptId;
  status: "OPEN" | "CONSUMED" | "EXPIRED" | "CANCELED";
  expiresAt: UtcTimestamp;
  flowStateDigest: string;
  initiatedAt: UtcTimestamp;
  initiatedBy: UserId;
  tenantId: TenantId;
}>;

export type GetAccountInput = Readonly<{
  accountId: AccountId;
  tenantId: TenantId;
}>;

export type GetAccountResult = Readonly<{
  account: ProviderAccountRecord | null;
}>;

export type ListAccountsInput = Readonly<{
  includeDisabled: boolean;
  tenantId: TenantId;
}>;

export type ListAccountsResult = Readonly<{
  accounts: readonly ProviderAccountRecord[];
}>;

export type StartConnectionInput = Readonly<{
  attemptId: ConnectionAttemptId;
  expiresAt: UtcTimestamp;
  flowStateDigest: string;
  initiatedAt: UtcTimestamp;
  initiatedBy: UserId;
  tenantId: TenantId;
}>;

export type StartConnectionResult =
  | Readonly<{
      attempt: ConnectionAttemptRecord;
      outcome: "CREATED";
    }>
  | Readonly<{
      attempt: ConnectionAttemptRecord;
      outcome: "ALREADY_EXISTS";
    }>;

export type GetConnectionAttemptInput = Readonly<{
  attemptId: ConnectionAttemptId;
  tenantId: TenantId;
}>;

export type GetConnectionAttemptResult = Readonly<{
  attempt: ConnectionAttemptRecord | null;
}>;

export type BindAccountInput = Readonly<{
  accountId: AccountId;
  boundAt: UtcTimestamp;
  providerAccountId: string;
  providerUserId: string | null;
  tenantId: TenantId;
  connectionAttemptId: ConnectionAttemptId;
}>;

export type BindAccountResult =
  | Readonly<{
      account: ProviderAccountRecord;
      outcome: "BOUND";
    }>
  | Readonly<{
      account: ProviderAccountRecord;
      outcome: "ALREADY_BOUND";
    }>
  | Readonly<{
      conflictingAccountId: AccountId;
      outcome: "PROVIDER_ACCOUNT_CONFLICT";
    }>;

export type RecordAccountHealthInput = Readonly<{
  accountId: AccountId;
  expectedRevision: AccountRevisionGuard;
  health: AccountHealth;
  tenantId: TenantId;
}>;

export type RecordAccountHealthResult =
  | Readonly<{
      account: ProviderAccountRecord;
      outcome: "UPDATED";
    }>
  | Readonly<{
      current: ProviderAccountRecord;
      outcome: "REVISION_CONFLICT";
    }>;

export type AccountRevisionGuard = Readonly<{
  expectedRevision: number;
}>;

/**
 * Provider identifiers are bound only through a persisted, expiring attempt.
 * The browser callback is not an ownership proof and provider SDKs do not
 * appear in this interface.
 */
export interface AccountRepository {
  bind: (
    input: BindAccountInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<BindAccountResult>>;
  get: (
    input: GetAccountInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetAccountResult>>;
  getConnectionAttempt: (
    input: GetConnectionAttemptInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetConnectionAttemptResult>>;
  list: (
    input: ListAccountsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListAccountsResult>>;
  recordHealth: (
    input: RecordAccountHealthInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordAccountHealthResult>>;
  startConnection: (
    input: StartConnectionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<StartConnectionResult>>;
}
