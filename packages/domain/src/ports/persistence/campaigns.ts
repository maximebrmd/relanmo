import type {
  CampaignId,
  CampaignVersionId,
  EvidenceId,
  ExplicitStyleVersionId,
  InferredStyleVersionId,
  ModelVersion,
  PromptOverrideVersionId,
  TenantId,
  UserId,
} from "../../contracts/ids";
import type { StyleStepOverride } from "../../contracts/product/style";
import type {
  BusinessWindowConfiguration,
  SequenceStep,
  UtcTimestamp,
} from "../../contracts/values";
import type {
  CampaignVersionRef,
  CurrentVersionSet,
  ExplicitStyleVersionRef,
  InferredStyleVersionRef,
  PromptOverrideVersionRef,
} from "../../contracts/versions";
import type {
  CurrentVersionGuard,
  PersistenceResult,
  PersistenceTransaction,
  RevisionMutationResult,
} from "./common";

export type SequenceStepConfiguration = Readonly<{
  minimumGapFromPreviousSendDays: number | null;
  requiresAcceptance: boolean;
  step: SequenceStep;
  targetOffsetFromAcceptanceDays: number | null;
}>;

export type SequenceClosureConfiguration = Readonly<{
  minimumDaysAfterDelayedDm5: number;
  minimumDaysAfterDm1: number;
}>;

export type CampaignDefinition = Readonly<{
  businessWindow: BusinessWindowConfiguration;
  exclusions: readonly string[];
  dailyInvitationQuota: number;
  dailyMessageQuota: number;
  icpDescription: string;
  name: string;
  sequenceClosure: SequenceClosureConfiguration;
  sequencePlan: readonly SequenceStepConfiguration[];
}>;

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type CampaignVersionRecord = Readonly<{
  createdAt: UtcTimestamp;
  createdBy: UserId;
  definition: CampaignDefinition;
  tenantId: TenantId;
  version: CampaignVersionRef;
}>;

export type CampaignRecord = Readonly<{
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  currentVersion: CampaignVersionRecord | null;
  status: CampaignStatus;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type GetCampaignInput = Readonly<{
  campaignId: CampaignId;
  tenantId: TenantId;
}>;

export type GetCampaignResult = Readonly<{
  campaign: CampaignRecord | null;
}>;

export type ListCampaignsInput = Readonly<{
  includeCompleted: boolean;
  tenantId: TenantId;
}>;

export type ListCampaignsResult = Readonly<{
  campaigns: readonly CampaignRecord[];
}>;

export type CreateCampaignInput = Readonly<{
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  createdBy: UserId;
  definition: CampaignDefinition;
  initialVersionId: CampaignVersionId;
  tenantId: TenantId;
}>;

export type CreateCampaignResult =
  | Readonly<{
      campaign: CampaignRecord;
      outcome: "CREATED";
    }>
  | Readonly<{
      existing: CampaignRecord;
      outcome: "ALREADY_EXISTS";
    }>;

export type SaveCampaignVersionInput = Readonly<{
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  createdBy: UserId;
  definition: CampaignDefinition;
  expectedCurrent: CurrentVersionGuard;
  tenantId: TenantId;
  versionId: CampaignVersionId;
}>;

export type SaveCampaignVersionValue = Readonly<{
  campaign: CampaignRecord;
  current: CurrentVersionSet;
  version: CampaignVersionRecord;
}>;

export type SaveCampaignVersionResult =
  RevisionMutationResult<SaveCampaignVersionValue>;

export type ActivateCampaignInput = Readonly<{
  campaignId: CampaignId;
  expectedCurrent: CurrentVersionGuard;
  requestedAt: UtcTimestamp;
  tenantId: TenantId;
  versionId: CampaignVersionId;
}>;

export type CampaignStateMutationValue = Readonly<{
  campaign: CampaignRecord;
  current: CurrentVersionSet;
}>;

export type ActivateCampaignResult =
  RevisionMutationResult<CampaignStateMutationValue>;

export type PauseCampaignInput = Readonly<{
  campaignId: CampaignId;
  expectedCurrent: CurrentVersionGuard;
  pausedAt: UtcTimestamp;
  tenantId: TenantId;
}>;

export type PauseCampaignResult =
  RevisionMutationResult<CampaignStateMutationValue>;

/** Campaign versions are immutable; activation and pause both use the shared guard. */
export interface CampaignRepository {
  activate: (
    input: ActivateCampaignInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ActivateCampaignResult>>;
  create: (
    input: CreateCampaignInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<CreateCampaignResult>>;
  get: (
    input: GetCampaignInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetCampaignResult>>;
  list: (
    input: ListCampaignsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListCampaignsResult>>;
  pause: (
    input: PauseCampaignInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<PauseCampaignResult>>;
  saveVersion: (
    input: SaveCampaignVersionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveCampaignVersionResult>>;
}

export type ExplicitStyleSettings = Readonly<{
  addressForm: "VOUS" | "TU";
  closing: string | null;
  examples: readonly string[];
  forbiddenPhrases: readonly string[];
  formality: "CASUAL" | "NEUTRAL" | "FORMAL";
  greeting: string | null;
  instructions: string | null;
  maxCharacters: number | null;
  tone: string;
}>;

export type InferredStyleSettings = Readonly<{
  confidence: number | null;
  formality: "CASUAL" | "NEUTRAL" | "FORMAL" | null;
  tone: string | null;
}>;

export type ExplicitStyleVersionRecord = Readonly<{
  createdAt: UtcTimestamp;
  createdBy: UserId;
  settings: ExplicitStyleSettings;
  tenantId: TenantId;
  version: ExplicitStyleVersionRef;
}>;

export type InferredStyleVersionRecord = Readonly<{
  createdAt: UtcTimestamp;
  model: ModelVersion;
  sourceEvidenceIds: readonly [EvidenceId, ...EvidenceId[]];
  settings: InferredStyleSettings;
  tenantId: TenantId;
  version: InferredStyleVersionRef;
}>;

export type GetStyleInput = Readonly<{
  campaignId?: CampaignId;
  tenantId: TenantId;
}>;

export type GetStyleResult = Readonly<{
  acceptedInferred: InferredStyleVersionRecord | null;
  current: CurrentVersionSet;
  explicit: ExplicitStyleVersionRecord | null;
  overrides: readonly StyleOverrideVersionRecord[];
}>;

export type StyleOverrideSettings = Readonly<
  Partial<
    Pick<
      ExplicitStyleSettings,
      | "addressForm"
      | "closing"
      | "forbiddenPhrases"
      | "greeting"
      | "maxCharacters"
      | "tone"
    >
  >
>;

export type StyleOverrideVersionRecord = Readonly<{
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  createdBy: UserId;
  settings: StyleOverrideSettings;
  stepOverrides: readonly StyleStepOverride[];
  tenantId: TenantId;
  version: PromptOverrideVersionRef;
}>;

export type SaveExplicitStyleInput = Readonly<{
  createdAt: UtcTimestamp;
  createdBy: UserId;
  expectedCurrent: CurrentVersionGuard;
  settings: ExplicitStyleSettings;
  tenantId: TenantId;
  versionId: ExplicitStyleVersionId;
}>;

export type SaveExplicitStyleValue = Readonly<{
  current: CurrentVersionSet;
  style: ExplicitStyleVersionRecord;
}>;

export type SaveExplicitStyleResult =
  RevisionMutationResult<SaveExplicitStyleValue>;

export type SaveStyleOverrideInput = Readonly<{
  campaignId: CampaignId;
  createdAt: UtcTimestamp;
  createdBy: UserId;
  expectedCurrent: CurrentVersionGuard;
  settings: StyleOverrideSettings;
  stepOverrides: readonly StyleStepOverride[];
  tenantId: TenantId;
  versionId: PromptOverrideVersionId;
}>;

export type ResetStyleToDefaultsInput = Readonly<{
  expectedCurrent: CurrentVersionGuard;
  tenantId: TenantId;
}>;

export type ResetStyleToDefaultsResult = RevisionMutationResult<
  Readonly<{ current: CurrentVersionSet }>
>;

export type SaveStyleOverrideResult = RevisionMutationResult<
  Readonly<{
    current: CurrentVersionSet;
    override: StyleOverrideVersionRecord;
  }>
>;

export type SaveInferredStyleInput = Readonly<{
  createdAt: UtcTimestamp;
  model: ModelVersion;
  sourceEvidenceIds: readonly [EvidenceId, ...EvidenceId[]];
  settings: InferredStyleSettings;
  tenantId: TenantId;
  versionId: InferredStyleVersionId;
}>;

export type SaveInferredStyleResult =
  | Readonly<{
      outcome: "CREATED";
      style: InferredStyleVersionRecord;
    }>
  | Readonly<{
      existing: InferredStyleVersionRecord;
      outcome: "ALREADY_EXISTS";
    }>;

export type AcceptInferredStyleInput = Readonly<{
  expectedCurrent: CurrentVersionGuard;
  tenantId: TenantId;
  versionId: InferredStyleVersionId;
}>;

export type AcceptInferredStyleResult = RevisionMutationResult<
  Readonly<{
    current: CurrentVersionSet;
    style: InferredStyleVersionRecord;
  }>
>;

/** Explicit customer edits and accepted inference share the same current-version guard. */
export interface StyleRepository {
  acceptInferred: (
    input: AcceptInferredStyleInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<AcceptInferredStyleResult>>;
  get: (
    input: GetStyleInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetStyleResult>>;
  resetToDefaults: (
    input: ResetStyleToDefaultsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ResetStyleToDefaultsResult>>;
  saveExplicit: (
    input: SaveExplicitStyleInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveExplicitStyleResult>>;
  saveInferred: (
    input: SaveInferredStyleInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveInferredStyleResult>>;
  saveOverride: (
    input: SaveStyleOverrideInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveStyleOverrideResult>>;
}
