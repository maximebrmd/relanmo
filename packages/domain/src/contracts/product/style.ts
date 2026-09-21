import type { EvidenceAssertion } from "../evidence";
import type {
  CampaignId,
  EvidenceId,
  ExplicitStyleVersionId,
  InferredStyleVersionId,
  TenantId,
} from "../ids";
import type { DirectMessageStep, UtcTimestamp } from "../values";
import type {
  ProductCommandResult,
  ProductViewState,
  ProspectSelector,
  RevisionGuard,
  TenantSelector,
} from "./common";
import type { FrenchTone } from "./profile";

export const STYLE_SOURCES = [
  "DEFAULT",
  "EXPLICIT",
  "INFERRED_ACCEPTED",
] as const;
export type StyleSource = (typeof STYLE_SOURCES)[number];

export const ADDRESS_FORMS = ["VOUS", "TU"] as const;
export type AddressForm = (typeof ADDRESS_FORMS)[number];

export const STYLE_FORMALITY_LEVELS = ["CASUAL", "NEUTRAL", "FORMAL"] as const;
export type StyleFormality = (typeof STYLE_FORMALITY_LEVELS)[number];

export type StyleOverrideCertification = Readonly<{
  authority: "APPLICATION_POLICY";
  certifiedAt: UtcTimestamp;
  certifiedText: string;
  certificationId: string;
  step: DirectMessageStep;
}>;

export type StyleStepOverrideGrounding =
  | Readonly<{
      certification: StyleOverrideCertification;
      kind: "CERTIFIED_NEUTRAL";
    }>
  | Readonly<{
      assertions: readonly [EvidenceAssertion, ...EvidenceAssertion[]];
      certification: StyleOverrideCertification;
      kind: "ASSERTIONS";
    }>;

export type StyleStepOverride = Readonly<{
  grounding: StyleStepOverrideGrounding;
  step: DirectMessageStep;
  text: string;
}>;

export type StyleStepOverrideInput = Readonly<{
  step: DirectMessageStep;
  text: string;
}>;

export type StyleInput = Readonly<{
  addressForm: AddressForm;
  examples: readonly string[];
  instructions: string | null;
  stepOverrides: readonly StyleStepOverrideInput[];
  tone: FrenchTone;
}>;

export type StyleView = Readonly<
  StyleInput & {
    acceptedInferredStyleVersionId: InferredStyleVersionId | null;
    explicitStyleVersionId: ExplicitStyleVersionId | null;
    inferredEvidenceIds: readonly EvidenceId[];
    revision: number;
    source: StyleSource;
    suggestedInferredStyleVersionId: InferredStyleVersionId | null;
    tenantId: TenantId;
    updatedAt: UtcTimestamp;
  }
>;

export type DraftPreviewView = Readonly<{
  /** A preview has no ActionId and cannot be dispatched by this contract. */
  generatedAt: UtcTimestamp;
  expiresAt: UtcTimestamp;
  previewId: string;
  sendAuthorization: "NOT_REQUESTED";
  sendEnqueued: false;
  step: DirectMessageStep;
  text: string;
  tenantId: TenantId;
}>;

export const STYLE_COMMAND_KINDS = [
  "SAVE_STYLE",
  "RESET_STYLE_OVERRIDE",
  "ACCEPT_INFERRED_STYLE",
  "PREVIEW_DRAFT",
] as const;
export type StyleCommandKind = (typeof STYLE_COMMAND_KINDS)[number];

export type SaveStyleCommand = Readonly<
  TenantSelector &
    RevisionGuard & {
      input: StyleInput;
      kind: "SAVE_STYLE";
    }
>;

export type ResetStyleOverrideCommand = Readonly<
  TenantSelector &
    RevisionGuard & {
      kind: "RESET_STYLE_OVERRIDE";
      step: DirectMessageStep;
    }
>;

export type AcceptInferredStyleCommand = Readonly<
  TenantSelector &
    RevisionGuard & {
      inferredStyleVersionId: InferredStyleVersionId;
      kind: "ACCEPT_INFERRED_STYLE";
    }
>;

export type PreviewDraftCommand = Readonly<
  ProspectSelector & {
    campaignId: CampaignId;
    kind: "PREVIEW_DRAFT";
    step: DirectMessageStep;
    styleRevision: number;
  }
>;

export type StyleCommand =
  | SaveStyleCommand
  | ResetStyleOverrideCommand
  | AcceptInferredStyleCommand
  | PreviewDraftCommand;

export type StyleQuery = TenantSelector;
export type StyleCommandResult = ProductCommandResult<
  DraftPreviewView | StyleView
>;
export type StylePreviewResult = ProductCommandResult<DraftPreviewView>;
export type StyleViewResult = ProductViewState<StyleView>;

export type StyleCommandHandler = (
  command: StyleCommand
) => Promise<StyleCommandResult>;
export type StyleQueryHandler = (query: StyleQuery) => Promise<StyleViewResult>;
