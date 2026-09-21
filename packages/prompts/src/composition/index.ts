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
  ComposeBaseSourceVersions,
  ComposeFailureCode,
  ComposeFailureReason,
  CompositionProvenance,
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
  PromptOverrideVersionRef,
  ResolvedStyle,
  ResolvedStyleField,
  StoppedPrompt,
  StylePrecedenceSource,
  StyleStepOverride,
  VersionedAcceptedInferredStyleLayer,
  VersionedCampaignStyleOverride,
  VersionedExplicitStyleLayer,
  VersionedFreelancerProfile,
} from "./types";
export type {
  AddressForm,
  StyleFormality,
} from "@relanmo/domain/contracts/product";

export const promptCompositionSurface = "ENABLED" as const;
