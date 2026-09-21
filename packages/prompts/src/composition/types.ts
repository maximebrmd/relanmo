import type {
  CampaignVersionRef,
  DraftSourceVersions,
  Evidence,
  EvidenceId,
  ExplicitStyleVersionRef,
  InferredStyleVersionRef,
  ModelVersion,
  ProspectId,
  ProfileVersionRef,
  PromptOverrideVersionRef,
  SequenceStep,
  TenantId,
} from "@relanmo/domain/contracts";
import type { WritingOutputBudget } from "@relanmo/domain/ports/providers";
import type {
  ExplicitStyleSettings,
  StyleOverrideSettings,
} from "@relanmo/domain/ports/persistence/campaigns";
import type {
  AddressForm,
  StyleFormality,
  StyleStepOverride as PersistedStyleStepOverride,
} from "@relanmo/domain/contracts/product";

import type { MessageHook, SequenceDraftingContext } from "../defaults";

export const STYLE_PRECEDENCE = [
  "CAMPAIGN_OVERRIDE",
  "EXPLICIT",
  "INFERRED_ACCEPTED",
  "DEFAULT",
] as const;
export type StylePrecedenceSource = (typeof STYLE_PRECEDENCE)[number];

export const COMPOSE_FAILURE_CODES = [
  "UNSUPPORTED_VARIABLE",
  "MISSING_EVIDENCE",
  "INVALID_STYLE_INPUT",
  "INVALID_EVIDENCE_INPUT",
  "INVALID_CONTEXT_INPUT",
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

export type StyleStepOverride = PersistedStyleStepOverride;

export type CampaignStyleOverride = Readonly<
  StyleOverrideSettings & {
    stepOverrides?: readonly StyleStepOverride[];
  }
>;

export type { PromptOverrideVersionRef };

export type ExplicitStyleLayer = ExplicitStyleSettings;

export type InferredStyleLayer = Readonly<{
  formality: StyleFormality | null;
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
  model: ModelVersion;
}>;

export type FreelancerProfileFacts = Readonly<{
  availability: string | null;
  exclusions: readonly string[];
  geography: string | null;
  offer: string | null;
  skills: readonly string[];
  targetMarket: string | null;
}>;

export type VersionedFreelancerProfile = Readonly<{
  facts: FreelancerProfileFacts;
  version: ProfileVersionRef;
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
  sharedConnection: GroundedFact | null;
  signalDetail: GroundedFact | null;
  signalFact: GroundedFact | null;
}>;

export type ProspectContextSnapshot = Readonly<{
  company: string | null;
  craft: string | null;
  firstName: string | null;
  hiringRole: GroundedFact | null;
  prospectId: ProspectId;
  sharedConnection: GroundedFact | null;
  signalDetail: GroundedFact | null;
  signalFact: GroundedFact | null;
}>;

export type CompositionProvenance = Readonly<{
  allowedEvidenceIds: readonly EvidenceId[];
  drafting: SequenceDraftingContext;
  prospectContext: ProspectContextSnapshot;
  sourceVersions: DraftSourceVersions;
}>;

export type ComposePromptInput = Readonly<{
  acceptedInferredStyle: VersionedAcceptedInferredStyleLayer | null;
  allowedEvidence: readonly Evidence[];
  campaignOverride: VersionedCampaignStyleOverride | null;
  drafting: SequenceDraftingContext;
  explicitStyle: VersionedExplicitStyleLayer | null;
  profile: VersionedFreelancerProfile | null;
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
  formality: ResolvedStyleField<StyleFormality>;
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
  sourceVersions: DraftSourceVersions;
}>;

export type ComposedPrompt = Readonly<
  ComposeResultBase & {
    allowedEvidenceIds: readonly EvidenceId[];
    composedInput: string;
    hook: MessageHook;
    kind: "COMPOSED";
    outputBudget: WritingOutputBudget;
    profileAdaptation: "PROFILE_FACTS_ONLY";
    provenance: CompositionProvenance;
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
