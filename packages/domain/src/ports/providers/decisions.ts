import type {
  EvidenceId,
  ModelVersion,
  ProspectId,
  TenantId,
} from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  ModelUsage,
  ProviderOperationContext,
  ProviderReadResult,
} from "./common";

export type TypeSafeChoice = Readonly<{
  id: string;
  label: string;
}>;

export type TypeSafeQuestion = Readonly<{
  choices: readonly TypeSafeChoice[];
  id: string;
  prompt: string;
  schemaVersion: string;
}>;

export const TYPESAFE_LIMITS = {
  maxEvidence: 64,
  maxPromptCharacters: 2000,
  maxQuestionChoices: 16,
} as const;

export type TypeSafeEvidence = Readonly<{
  evidenceId: EvidenceId;
  claim: string;
}>;

export type TypeSafeDecisionInput = Readonly<{
  context: ProviderOperationContext;
  evidence: readonly TypeSafeEvidence[];
  modelVersion: ModelVersion;
  prospectId: ProspectId;
  question: TypeSafeQuestion;
  tenantId: TenantId;
}>;

export const TYPESAFE_UNCERTAINTY = ["HIGH", "LOW", "MEDIUM"] as const;
export type TypeSafeUncertainty = (typeof TYPESAFE_UNCERTAINTY)[number];

export type TypeSafeDecision = Readonly<{
  answer: TypeSafeChoice | null;
  answerEvidenceIds: readonly EvidenceId[];
  evaluatedAt: UtcTimestamp;
  modelVersion: ModelVersion;
  questionId: string;
  schemaVersion: string;
  uncertainty: TypeSafeUncertainty;
  usage: ModelUsage;
}>;

/** A decision is advisory evidence; it contains no send authorization. */
export type TypeSafeDecisionPort = Readonly<{
  decide: (
    input: TypeSafeDecisionInput
  ) => Promise<ProviderReadResult<TypeSafeDecision>>;
}>;
