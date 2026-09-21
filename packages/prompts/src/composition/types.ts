import type {
  CampaignVersionRef,
  DirectMessageStep,
  DraftSourceVersions,
  Evidence,
  EvidenceId,
  ExplicitStyleVersionRef,
  InferredStyleVersionRef,
  ModelVersion,
  ProspectId,
  ProfileVersionRef,
  PromptVersionRef,
  SequenceStep,
  TenantId,
  UtcTimestamp,
} from "@relanmo/domain/contracts";
import type { WritingOutputBudget } from "@relanmo/domain/ports/providers";

import type { MessageHook, SequenceDraftingContext } from "../defaults";

export const STYLE_PRECEDENCE = [
  "CAMPAIGN_OVERRIDE",
  "EXPLICIT",
  "INFERRED_ACCEPTED",
  "DEFAULT",
] as const;
export type StylePrecedenceSource = (typeof STYLE_PRECEDENCE)[number];

export const FORMALITY_LEVELS = ["CASUAL", "NEUTRAL", "FORMAL"] as const;
export type FormalityLevel = (typeof FORMALITY_LEVELS)[number];

export const ADDRESS_FORMS = ["VOUS", "TU"] as const;
export type AddressForm = (typeof ADDRESS_FORMS)[number];

export const COMPOSE_FAILURE_CODES = [
  "UNSUPPORTED_VARIABLE",
  "MISSING_EVIDENCE",
  "STEP_NOT_IN_PLAN",
] as const;
export type ComposeFailureCode = (typeof COMPOSE_FAILURE_CODES)[number];

export const COMPOSE_SEND_CONTROLS = Object.freeze({
  customerTextCannotAuthorizeSend: true,
  invitationHasNote: false,
  replyStopsAutomatedOutreach: true,
  userProspectTextIsDataOnly: true,
});
export type ComposeSendControls = typeof COMPOSE_SEND_CONTROLS;

export type StyleStepOverride = Readonly<{
  step: DirectMessageStep;
  text: string;
}>;

export type CampaignStyleOverride = Readonly<{
  closing?: string | null;
  forbiddenPhrases?: readonly string[];
  greeting?: string | null;
  maxCharacters?: number | null;
  stepOverrides?: readonly StyleStepOverride[];
  tone?: string | null;
}>;

export type PromptOverrideVersionRef = Readonly<{
  createdAt: UtcTimestamp;
  id: string;
  kind: "PROMPT_OVERRIDE";
  revision: number;
}>;

export type ExplicitStyleLayer = Readonly<{
  closing: string | null;
  examples: readonly string[];
  forbiddenPhrases: readonly string[];
  formality: FormalityLevel;
  greeting: string | null;
  instructions: string | null;
  maxCharacters: number | null;
  stepOverrides: readonly StyleStepOverride[];
  tone: string;
}>;

export type InferredStyleLayer = Readonly<{
  formality: FormalityLevel | null;
  tone: string | null;
}>;

export type VersionedCampaignStyleOverride = Readonly<{
  style: CampaignStyleOverride;
  version: PromptOverrideVersionRef;
}>;

export type VersionedExplicitStyleLayer = Readonly<{
  style: ExplicitStyleLayer;
  version: ExplicitStyleVersionRef;
}>;

export type VersionedAcceptedInferredStyleLayer = Readonly<{
  style: InferredStyleLayer;
  version: InferredStyleVersionRef;
}>;

export type ComposeBaseSourceVersions = Readonly<{
  campaign: CampaignVersionRef;
  defaultPrompt: PromptVersionRef;
  model: ModelVersion;
  profile: ProfileVersionRef | null;
}>;

export type CompositionSourceVersions = Readonly<
  DraftSourceVersions & {
    campaignOverride: PromptOverrideVersionRef | null;
  }
>;

export type FreelancerProfileFacts = Readonly<{
  availability: string | null;
  exclusions: readonly string[];
  geography: string | null;
  offer: string | null;
  skills: readonly string[];
  targetMarket: string | null;
}>;

export type GroundedFact = Readonly<{
  evidenceId: EvidenceId;
  text: string;
}>;

export type ProspectGrounding = Readonly<{
  company: string | null;
  craft: string | null;
  firstName: string | null;
  hiringRole: GroundedFact | null;
  prospectId: ProspectId;
  signalDetail: GroundedFact | null;
  signalFact: GroundedFact | null;
}>;

export type ComposePromptInput = Readonly<{
  acceptedInferredStyle: VersionedAcceptedInferredStyleLayer | null;
  allowedEvidence: readonly Evidence[];
  campaignOverride: VersionedCampaignStyleOverride | null;
  drafting: SequenceDraftingContext;
  explicitStyle: VersionedExplicitStyleLayer | null;
  profile: FreelancerProfileFacts;
  prospect: ProspectGrounding;
  sourceVersions: ComposeBaseSourceVersions;
  step: SequenceStep;
  tenantId: TenantId;
}>;

export type ResolvedStyleField<Value> = Readonly<{
  source: StylePrecedenceSource;
  value: Value;
}>;

export type ResolvedStyle = Readonly<{
  addressForm: ResolvedStyleField<AddressForm>;
  closing: ResolvedStyleField<string | null>;
  examples: ResolvedStyleField<readonly string[]>;
  forbiddenPhrases: ResolvedStyleField<readonly string[]>;
  formality: ResolvedStyleField<FormalityLevel>;
  greeting: ResolvedStyleField<string | null>;
  instructions: ResolvedStyleField<string | null>;
  maxCharacters: ResolvedStyleField<number>;
  tone: ResolvedStyleField<string>;
}>;

export type ComposeFailureReason = Readonly<{
  code: ComposeFailureCode;
  detail: string;
}>;

type ComposeResultBase = Readonly<{
  sendControls: ComposeSendControls;
  sourceVersions: CompositionSourceVersions;
}>;

export type ComposedPrompt = Readonly<
  ComposeResultBase & {
    allowedEvidenceIds: readonly EvidenceId[];
    composedInput: string;
    hook: MessageHook;
    kind: "COMPOSED";
    outputBudget: WritingOutputBudget;
    profileAdaptation: "PROFILE_FACTS_ONLY";
    requiresWriting: boolean;
    resolvedStyle: ResolvedStyle;
    step: SequenceStep;
    targetText: string;
    templateId: string;
    usedNeutralFallback: boolean;
  }
>;

export type StoppedPrompt = Readonly<
  ComposeResultBase & {
    kind: "STOPPED";
    reason: "INCOMING_REPLY";
  }
>;

export type FailedPrompt = Readonly<
  ComposeResultBase & {
    kind: "FAILED";
    reasons: readonly [ComposeFailureReason, ...ComposeFailureReason[]];
  }
>;

export type ComposePromptResult = ComposedPrompt | StoppedPrompt | FailedPrompt;
