import type { Evidence } from "../../contracts/evidence";
import type {
  AccountId,
  CampaignId,
  EvidenceId,
  ProspectId,
  TenantId,
  UserId,
} from "../../contracts/ids";
import type {
  AccountProspectOwnership,
  HumanOwnershipReason,
  SuppressionEntry,
  SuppressionReason,
} from "../../contracts/ownership";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  AccountProspectKey,
  PersistenceResult,
  PersistenceTransaction,
} from "./common";

export const PROSPECT_STATUSES = ["ACTIVE", "ARCHIVED", "INVALID"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export type ProspectProfileSnapshot = Readonly<{
  company: string | null;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  profileUrl: string | null;
}>;

export type ProspectRecord = Readonly<{
  accountId: AccountId;
  createdAt: UtcTimestamp;
  evidenceIds: readonly EvidenceId[];
  profile: ProspectProfileSnapshot;
  prospectId: ProspectId;
  providerProfileId: string;
  status: ProspectStatus;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type GetProspectInput = Readonly<{
  accountId: AccountId;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export type GetProspectResult = Readonly<{
  prospect: ProspectRecord | null;
}>;

export type UpsertProspectInput = Readonly<{
  accountId: AccountId;
  observedAt: UtcTimestamp;
  profile: ProspectProfileSnapshot;
  prospectId: ProspectId;
  providerProfileId: string;
  tenantId: TenantId;
}>;

export type UpsertProspectResult =
  | Readonly<{
      outcome: "CREATED" | "UPDATED";
      prospect: ProspectRecord;
    }>
  | Readonly<{
      conflictingProspectId: ProspectId;
      outcome: "IDENTITY_COLLISION";
    }>;

export type ListProspectsInput = Readonly<{
  accountId: AccountId;
  includeArchived: boolean;
  limit: number;
  tenantId: TenantId;
}>;

export type ListProspectsResult = Readonly<{
  nextCursor: string | null;
  prospects: readonly ProspectRecord[];
}>;

/** Provider identity collisions are returned explicitly and never merged silently. */
export interface ProspectRepository {
  get: (
    input: GetProspectInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetProspectResult>>;
  list: (
    input: ListProspectsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListProspectsResult>>;
  upsert: (
    input: UpsertProspectInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<UpsertProspectResult>>;
}

export type UpsertEvidenceInput = Readonly<{
  evidence: Evidence;
}>;

export type UpsertEvidenceResult =
  | Readonly<{
      evidence: Evidence;
      outcome: "CREATED";
    }>
  | Readonly<{
      evidence: Evidence;
      outcome: "ALREADY_EXISTS";
    }>;

export type GetEvidenceInput = Readonly<{
  evidenceId: EvidenceId;
  tenantId: TenantId;
}>;

export type GetEvidenceResult = Readonly<{
  evidence: Evidence | null;
}>;

export type ListEvidenceInput = Readonly<{
  accountId: AccountId | null;
  limit: number;
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export type ListEvidenceResult = Readonly<{
  evidence: readonly Evidence[];
}>;

/** Evidence is sourced and deduplicated; model assertions are not accepted as evidence. */
export interface EvidenceRepository {
  get: (
    input: GetEvidenceInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetEvidenceResult>>;
  list: (
    input: ListEvidenceInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListEvidenceResult>>;
  upsert: (
    input: UpsertEvidenceInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<UpsertEvidenceResult>>;
}

export type GetSuppressionInput = AccountProspectKey;

export type GetSuppressionResult = Readonly<{
  suppression: SuppressionEntry | null;
}>;

export type AddSuppressionInput = Readonly<{
  accountId: AccountId;
  prospectId: ProspectId;
  reason: SuppressionReason;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type AddSuppressionResult =
  | Readonly<{
      outcome: "ADDED";
      suppression: SuppressionEntry;
    }>
  | Readonly<{
      outcome: "ALREADY_PRESENT";
      suppression: SuppressionEntry;
    }>;

export interface SuppressionRepository {
  add: (
    input: AddSuppressionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AddSuppressionResult>>;
  get: (
    input: GetSuppressionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetSuppressionResult>>;
}

export type PairOwnershipRecord = Readonly<{
  accountProspect: AccountProspectOwnership;
  revision: number;
  updatedAt: UtcTimestamp;
}>;

export type GetPairOwnershipInput = AccountProspectKey;

export type GetPairOwnershipResult = Readonly<{
  ownership: PairOwnershipRecord | null;
}>;

export type ClaimBotEligibilityInput = Readonly<{
  accountId: AccountId;
  campaignId: CampaignId;
  prospectId: ProspectId;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
  expectedRevision: number | null;
}>;

export type ClaimBotEligibilityResult =
  | Readonly<{
      outcome: "CLAIMED";
      ownership: PairOwnershipRecord;
    }>
  | Readonly<{
      outcome: "HUMAN_OWNED";
      ownership: PairOwnershipRecord;
    }>
  | Readonly<{
      current: PairOwnershipRecord;
      expectedRevision: number;
      outcome: "REVISION_CONFLICT";
    }>;

export type MarkHumanOwnershipInput = Readonly<{
  accountId: AccountId;
  ownerUserId: UserId | null;
  prospectId: ProspectId;
  reason: HumanOwnershipReason;
  recordedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type MarkHumanOwnershipResult = Readonly<{
  ownership: PairOwnershipRecord;
  outcome: "MARKED" | "ALREADY_HUMAN_OWNED";
}>;

/** Ownership is one durable account/prospect row, never one row per campaign. */
export interface PairOwnershipRepository {
  claimBotEligibility: (
    input: ClaimBotEligibilityInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ClaimBotEligibilityResult>>;
  get: (
    input: GetPairOwnershipInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetPairOwnershipResult>>;
  markHuman: (
    input: MarkHumanOwnershipInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<MarkHumanOwnershipResult>>;
}
