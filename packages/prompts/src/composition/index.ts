export { composeGroundedPrompt } from "./compose";
export {
  ADDRESS_FORMS,
  COMPOSE_FAILURE_CODES,
  COMPOSE_SEND_CONTROLS,
  FORMALITY_LEVELS,
  STYLE_PRECEDENCE,
} from "./types";
export type {
  AddressForm,
  CampaignStyleOverride,
  ComposeFailureCode,
  ComposeFailureReason,
  ComposePromptInput,
  ComposePromptResult,
  ComposeSendControls,
  ComposedPrompt,
  ExplicitStyleLayer,
  FailedPrompt,
  FormalityLevel,
  FreelancerProfileFacts,
  GroundedFact,
  InferredStyleLayer,
  ProspectGrounding,
  ResolvedStyle,
  ResolvedStyleField,
  StoppedPrompt,
  StylePrecedenceSource,
  StyleStepOverride,
} from "./types";

export const promptCompositionSurface = "ENABLED" as const;
