import type { CampaignId, CampaignVersionId, TenantId } from "../ids";
import type {
  BusinessWindowConfiguration,
  SequenceStep,
  UtcTimestamp,
} from "../values";
import type {
  CampaignSelector,
  PageRequest,
  ProductPage,
  ProductCommandResult,
  ProductPauseReason,
  ProductViewState,
  RevisionGuard,
  TenantSelector,
} from "./common";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type CampaignTargeting = Readonly<{
  companySizes: readonly string[];
  geographies: readonly string[];
  industries: readonly string[];
  jobTitles: readonly string[];
  seniority: readonly string[];
}>;

export type CampaignSequenceStep = Readonly<{
  minimumGapFromPreviousSendDays: number | null;
  requiresAcceptance: boolean;
  step: SequenceStep;
  targetOffsetFromAcceptanceDays: number | null;
}>;

export type CampaignInput = Readonly<{
  businessWindow: BusinessWindowConfiguration;
  dailyQuota: number;
  exclusions: readonly string[];
  name: string;
  offer: string;
  sequence: readonly CampaignSequenceStep[];
  targeting: CampaignTargeting;
}>;

export type CampaignView = Readonly<
  CampaignInput & {
    activationAuthorizesBoundedSequence: true;
    activatedAt: UtcTimestamp | null;
    campaignId: CampaignId;
    campaignVersionId: CampaignVersionId | null;
    outboundPaused: boolean;
    pauseReason: ProductPauseReason | null;
    pausedAt: UtcTimestamp | null;
    revision: number;
    status: CampaignStatus;
    stopOnReply: true;
    tenantId: TenantId;
    updatedAt: UtcTimestamp;
  }
>;

export const CAMPAIGN_COMMAND_KINDS = [
  "CREATE_CAMPAIGN",
  "UPDATE_CAMPAIGN",
  "ACTIVATE_CAMPAIGN",
  "PAUSE_CAMPAIGN",
] as const;
export type CampaignCommandKind = (typeof CAMPAIGN_COMMAND_KINDS)[number];

export type CreateCampaignCommand = Readonly<
  TenantSelector & {
    input: CampaignInput;
    kind: "CREATE_CAMPAIGN";
  }
>;

export type UpdateCampaignCommand = Readonly<
  CampaignSelector &
    RevisionGuard & {
      input: CampaignInput;
      kind: "UPDATE_CAMPAIGN";
    }
>;

export type ActivateCampaignCommand = Readonly<
  CampaignSelector &
    RevisionGuard & {
      kind: "ACTIVATE_CAMPAIGN";
    }
>;

export type PauseCampaignCommand = Readonly<
  CampaignSelector &
    RevisionGuard & {
      kind: "PAUSE_CAMPAIGN";
    }
>;

export type CampaignCommand =
  | CreateCampaignCommand
  | UpdateCampaignCommand
  | ActivateCampaignCommand
  | PauseCampaignCommand;

export type CampaignListView = ProductPage<CampaignView>;
export type CampaignQuery =
  | Readonly<
      TenantSelector & {
        kind: "LIST_CAMPAIGNS";
        page: PageRequest;
      }
    >
  | Readonly<
      CampaignSelector & {
        kind: "GET_CAMPAIGN";
      }
    >;
export type CampaignCommandResult = ProductCommandResult<CampaignView>;
export type CampaignViewResult = ProductViewState<CampaignView>;
export type CampaignQueryResult = ProductViewState<
  CampaignView | CampaignListView
>;

export type CampaignCommandHandler = (
  command: CampaignCommand
) => Promise<CampaignCommandResult>;
export type CampaignQueryHandler = (
  query: CampaignQuery
) => Promise<CampaignQueryResult>;
