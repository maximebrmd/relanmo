import type {
  EvidenceId,
  ModelVersion,
  ProspectId,
  TenantId,
} from "../../contracts/ids";
import type { DirectMessageStep, UtcTimestamp } from "../../contracts/values";
import type { DraftSourceVersions } from "../../contracts/versions";
import type {
  ModelUsage,
  ProviderOperationContext,
  ProviderReadResult,
} from "./common";

export type WritingOutputBudget = Readonly<{
  maxCharacters: number;
  maxTokens: number;
}>;

export type WritingInput = Readonly<{
  allowedEvidenceIds: readonly EvidenceId[];
  composedInput: string;
  context: ProviderOperationContext;
  outputBudget: WritingOutputBudget;
  prospectId: ProspectId;
  sourceVersions: DraftSourceVersions;
  step: DirectMessageStep;
  tenantId: TenantId;
}>;

export type WritingResult = Readonly<{
  modelVersion: ModelVersion;
  observedAt: UtcTimestamp;
  text: string;
  usage: ModelUsage;
}>;

/** Writing produces draft text only; it never authorizes a send. */
export type WritingPort = Readonly<{
  compose: (input: WritingInput) => Promise<ProviderReadResult<WritingResult>>;
}>;
