export { composeGroundedPrompt } from "./compose";
export {
  ADDRESS_FORMS,
  STYLE_FORMALITY_LEVELS,
} from "@relanmo/domain/contracts/product";
export {
  COMPOSE_FAILURE_CODES,
  COMPOSE_SEND_CONTROLS,
  STYLE_PRECEDENCE,
} from "./types";
export type {
  CampaignStyleOverride,
  CampaignOverrideGroundingProvenance,
  ComposeBaseSourceVersions,
  ComposeFailureCode,
  ComposeFailureReason,
  CompositionProvenance,
  CompositionHook,
  ComposePromptInput,
  ComposePromptResult,
  ComposeSendControls,
  ComposedPrompt,
  ExplicitStyleLayer,
  FailedPrompt,
  FreelancerProfileFacts,
  GroundedFact,
  InferredStyleLayer,
  ProspectGrounding,
  ProspectContextSnapshot,
  ResolvedStyle,
  ResolvedStyleField,
  StoppedPrompt,
  StylePrecedenceSource,
  StyleStepOverride,
  VersionedAcceptedInferredStyleLayer,
  VersionedCampaignStyleOverride,
  VersionedCampaignSource,
  VersionedExplicitStyleLayer,
  VersionedFreelancerProfile,
} from "./types";
export type {
  AddressForm,
  StyleFormality,
} from "@relanmo/domain/contracts/product";
export type { PromptOverrideVersionRef } from "@relanmo/domain/contracts";

export const promptCompositionSurface = "ENABLED" as const;
