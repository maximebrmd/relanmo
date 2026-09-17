import type { EligibilityReasonCode } from "../eligibility";
import type {
  AccountId,
  CampaignId,
  ConversationId,
  ProspectId,
  TenantId,
} from "../ids";
import type { OwnershipKind } from "../ownership";
import type { SequenceStep, UtcTimestamp } from "../values";
import type {
  PageRequest,
  ProductPage,
  ProductViewState,
  TenantSelector,
} from "./common";

export const PIPELINE_STAGES = [
  "DISCOVERED",
  "INVITED",
  "CONNECTED",
  "DM1_SENT",
  "FOLLOW_UP",
  "REPLIED",
  "COMPLETED",
  "SUPPRESSED",
  "UNKNOWN",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_OWNERSHIP_FILTERS = [
  "ALL",
  "BOT_ELIGIBLE",
  "HUMAN_OWNED",
] as const;
export type PipelineOwnershipFilter =
  (typeof PIPELINE_OWNERSHIP_FILTERS)[number];

export const PIPELINE_AUTOMATION_STATES = [
  "ACTIVE",
  "PAUSED",
  "HUMAN_HANDOVER",
  "UNKNOWN",
] as const;
export type PipelineAutomationState =
  (typeof PIPELINE_AUTOMATION_STATES)[number];

export const PIPELINE_EVIDENCE_STATUSES = [
  "VALID",
  "MISSING",
  "UNKNOWN",
] as const;
export type PipelineEvidenceStatus =
  (typeof PIPELINE_EVIDENCE_STATUSES)[number];

export const PIPELINE_SORTS = [
  "RECENT_ACTIVITY",
  "NEXT_DUE_ASC",
  "NAME_ASC",
] as const;
export type PipelineSort = (typeof PIPELINE_SORTS)[number];

export type PipelineFilters = Readonly<{
  accountId: AccountId | null;
  automation: PipelineAutomationState | null;
  campaignId: CampaignId | null;
  evidence: PipelineEvidenceStatus | null;
  ownership: PipelineOwnershipFilter;
  search: string | null;
  sort: PipelineSort;
  stage: PipelineStage | null;
}>;

export type PipelineQuery = Readonly<
  TenantSelector & {
    filters: PipelineFilters;
    kind: "LIST_PIPELINE";
    page: PageRequest;
  }
>;

export type PipelineRowView = Readonly<{
  accountId: AccountId;
  automation: PipelineAutomationState;
  campaignId: CampaignId;
  campaignName: string;
  conversationId: ConversationId | null;
  displayName: string | null;
  evidenceCount: number;
  evidenceStatus: PipelineEvidenceStatus;
  holdReasons: readonly EligibilityReasonCode[];
  lastActivityAt: UtcTimestamp | null;
  nextDueAt: UtcTimestamp | null;
  nextStep: SequenceStep | null;
  prospectId: ProspectId;
  stage: PipelineStage;
  tenantId: TenantId;
  unknownActionCount: number;
  ownership: OwnershipKind;
  headline: string | null;
}>;

export type PipelinePageView = ProductPage<PipelineRowView>;
export type PipelineViewResult = ProductViewState<PipelinePageView>;

export type PipelineQueryHandler = (
  query: PipelineQuery
) => Promise<PipelineViewResult>;
