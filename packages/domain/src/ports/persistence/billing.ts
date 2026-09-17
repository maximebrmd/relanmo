import type {
  AccountId,
  ActionId,
  ModelVersion,
  PromptVersionId,
  TenantId,
} from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  AuditEventId,
  BillingEventId,
  ImportRunId,
  PersistencePrincipal,
  PersistenceResult,
  PersistenceTransaction,
  UsageEventId,
} from "./common";

export const ENTITLEMENT_STATES = [
  "ACTIVE",
  "TRIAL",
  "PAST_DUE",
  "CANCELED",
  "UNMAPPED",
] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export type BillingEntitlementRecord = Readonly<{
  active: boolean;
  effectiveAt: UtcTimestamp;
  providerSubscriptionId: string | null;
  state: EntitlementState;
  tenantId: TenantId;
  validUntil: UtcTimestamp | null;
}>;

export type BillingCustomerRecord = Readonly<{
  createdAt: UtcTimestamp;
  providerCustomerId: string;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type SubscriptionRecord = Readonly<{
  currentPeriodEnd: UtcTimestamp | null;
  providerCustomerId: string;
  providerSubscriptionId: string;
  state: EntitlementState;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type GetEntitlementInput = Readonly<{
  tenantId: TenantId;
}>;

export type GetEntitlementResult = Readonly<{
  customer: BillingCustomerRecord | null;
  entitlement: BillingEntitlementRecord;
  subscription: SubscriptionRecord | null;
}>;

export type BindBillingCustomerInput = Readonly<{
  createdAt: UtcTimestamp;
  providerCustomerId: string;
  tenantId: TenantId;
}>;

export type BindBillingCustomerResult =
  | Readonly<{
      customer: BillingCustomerRecord;
      outcome: "BOUND";
    }>
  | Readonly<{
      customer: BillingCustomerRecord;
      outcome: "ALREADY_BOUND";
    }>
  | Readonly<{
      existingTenantId: TenantId;
      outcome: "PROVIDER_CUSTOMER_CONFLICT";
    }>;

export type BillingEventChange = Readonly<{
  effectiveAt: UtcTimestamp;
  providerEventCreatedAt: UtcTimestamp;
  providerCustomerId: string;
  providerSubscriptionId: string | null;
  state: EntitlementState;
  validUntil: UtcTimestamp | null;
}>;

export type ApplyBillingEventInput = Readonly<{
  change: BillingEventChange;
  eventId: BillingEventId;
  eventType: string;
  occurredAt: UtcTimestamp;
  providerEventId: string;
  tenantId: TenantId;
}>;

export type ApplyBillingEventResult =
  | Readonly<{
      event: BillingEventRecord;
      entitlement: BillingEntitlementRecord;
      outcome: "APPLIED";
    }>
  | Readonly<{
      event: BillingEventRecord;
      entitlement: BillingEntitlementRecord;
      outcome: "DUPLICATE";
    }>
  | Readonly<{
      current: BillingEventRecord;
      entitlement: BillingEntitlementRecord;
      outcome: "STALE_IGNORED";
    }>;

export type BillingEventRecord = Readonly<{
  appliedAt: UtcTimestamp;
  eventId: BillingEventId;
  eventType: string;
  occurredAt: UtcTimestamp;
  providerEventId: string;
  providerEventCreatedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

/** Billing state is the persistence projection of already-verified provider events. */
export interface BillingRepository {
  applyEvent: (
    input: ApplyBillingEventInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ApplyBillingEventResult>>;
  bindCustomer: (
    input: BindBillingCustomerInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<BindBillingCustomerResult>>;
  getEntitlement: (
    input: GetEntitlementInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetEntitlementResult>>;
}

export const USAGE_KINDS = [
  "MODEL_INPUT_TOKENS",
  "MODEL_OUTPUT_TOKENS",
  "MODEL_REQUEST",
  "OUTBOUND_ACTION",
  "PROVIDER_REQUEST",
] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export type UsageEventRecord = Readonly<{
  accountId: AccountId | null;
  actionId: ActionId | null;
  costMinorUnits: number | null;
  createdAt: UtcTimestamp;
  eventId: UsageEventId;
  kind: UsageKind;
  model: ModelVersion | null;
  measurement: "ACTUAL" | "ESTIMATED";
  promptVersionId: PromptVersionId | null;
  quantity: number;
  tenantId: TenantId;
  unit: string;
}>;

export type RecordUsageInput = Readonly<{
  event: UsageEventRecord;
}>;

export type RecordUsageResult = Readonly<{
  event: UsageEventRecord;
  outcome: "RECORDED" | "DUPLICATE";
}>;

export interface UsageRepository {
  record: (
    input: RecordUsageInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordUsageResult>>;
}

export type AuditScalar = boolean | number | string | null;
export type AuditField = Readonly<{
  key: string;
  value: AuditScalar;
}>;

export type AuditEventRecord = Readonly<{
  actor: PersistencePrincipal | null;
  createdAt: UtcTimestamp;
  details: readonly AuditField[];
  entityId: string;
  entityKind: string;
  eventId: AuditEventId;
  idempotencyKey: string;
  tenantId: TenantId;
  type: string;
}>;

export type AppendAuditInput = Readonly<{
  event: AuditEventRecord;
}>;

export type AppendAuditResult = Readonly<{
  event: AuditEventRecord;
  outcome: "APPENDED" | "DUPLICATE";
}>;

/** Usage and audit receipts are idempotent append-only records. */
export interface AuditRepository {
  append: (
    input: AppendAuditInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AppendAuditResult>>;
}

export const IMPORT_SOURCES = ["CSV", "EXCEL", "LEGACY_EXPORT"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const IMPORT_RUN_STATES = [
  "RECEIVED",
  "VALIDATING",
  "APPLIED",
  "PARTIAL",
  "FAILED",
] as const;
export type ImportRunState = (typeof IMPORT_RUN_STATES)[number];

export type ImportRunRecord = Readonly<{
  completedAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
  fingerprint: string;
  importRunId: ImportRunId;
  source: ImportSource;
  state: ImportRunState;
  tenantId: TenantId;
  totalRows: number | null;
}>;

export const IMPORT_ENTITY_KINDS = [
  "PROFILE",
  "CAMPAIGN",
  "PROSPECT",
  "EVIDENCE",
  "SUPPRESSION",
  "MESSAGE",
] as const;
export type ImportEntityKind = (typeof IMPORT_ENTITY_KINDS)[number];

export type ImportRowRecord = Readonly<{
  entityKind: ImportEntityKind;
  error: string | null;
  importRunId: ImportRunId;
  rowNumber: number;
  state: "ACCEPTED" | "REJECTED" | "SKIPPED";
  tenantId: TenantId;
}>;

export type StartImportInput = Readonly<{
  createdAt: UtcTimestamp;
  fingerprint: string;
  importRunId: ImportRunId;
  source: ImportSource;
  tenantId: TenantId;
  totalRows: number | null;
}>;

export type StartImportResult =
  | Readonly<{
      importRun: ImportRunRecord;
      outcome: "CREATED";
    }>
  | Readonly<{
      importRun: ImportRunRecord;
      outcome: "ALREADY_EXISTS";
    }>;

export type RecordImportRowInput = Readonly<{
  row: ImportRowRecord;
}>;

export type RecordImportRowResult = Readonly<{
  outcome: "RECORDED" | "DUPLICATE";
  row: ImportRowRecord;
}>;

export type CompleteImportInput = Readonly<{
  completedAt: UtcTimestamp;
  importRunId: ImportRunId;
  state: "APPLIED" | "PARTIAL" | "FAILED";
  tenantId: TenantId;
}>;

export type CompleteImportResult = Readonly<{
  importRun: ImportRunRecord;
  outcome: "COMPLETED" | "ALREADY_COMPLETED";
}>;

/** Import rows are validated before application and retain rejected-row evidence. */
export interface ImportRepository {
  complete: (
    input: CompleteImportInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<CompleteImportResult>>;
  recordRow: (
    input: RecordImportRowInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordImportRowResult>>;
  start: (
    input: StartImportInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<StartImportResult>>;
}
