/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This adapter is the boundary for TypeSafe SDK errors and untyped vendor payloads. */

import type {
  EvidenceId,
  ModelVersion,
  UtcTimestamp,
} from "@relanmo/domain/contracts";
import {
  parseModelVersion,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  ModelUsage,
  ProviderOperationContext,
  ProviderReadResult,
  TypeSafeChoice,
  TypeSafeDecision,
  TypeSafeDecisionInput,
  TypeSafeDecisionPort,
  TypeSafeEvidence,
  TypeSafeQuestion,
  TypeSafeUncertainty,
} from "@relanmo/domain/ports/providers";
import {
  providerDefinitiveRefusal,
  providerInvalidInput,
  providerRetryableReadFailure,
  providerSuccess,
  providerUnavailableCredentials,
  TYPESAFE_LIMITS,
} from "@relanmo/domain/ports/providers";
import type {
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  choice,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  TypeSafeClient,
  TypeSafeError,
  UnprocessableEntityError,
} from "@typesafe-ai/sdk";

export const TYPESAFE_ADAPTER_LIMITS = {
  holdBelowConfidence: 0.5,
  maxRetries: 2,
  maxTimeoutMs: 10_000,
  mediumBelowConfidence: 0.75,
} as const;

export type TypeSafeSystemOneClient = Readonly<{
  systemOne: (
    request: SystemOneRequest,
    options?: RequestOptions
  ) => Promise<SystemOneResult<Questions>>;
}>;

export type TypeSafeDecisionPortOptions = Readonly<{
  apiKey?: string;
  client?: TypeSafeSystemOneClient;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
}>;

export type TypeSafeIndependentDecisionInput = Readonly<{
  context: ProviderOperationContext;
  evidence: readonly TypeSafeEvidence[];
  modelVersion: ModelVersion;
  prospectId: TypeSafeDecisionInput["prospectId"];
  questions: readonly TypeSafeQuestion[];
  tenantId: TypeSafeDecisionInput["tenantId"];
}>;

export type TypeSafeDependentDecisionInput = TypeSafeDecisionInput &
  Readonly<{
    priorDecisions: readonly TypeSafeDecision[];
  }>;

export type TypeSafeDecisionAdapter = TypeSafeDecisionPort &
  Readonly<{
    decideDependent: (
      input: TypeSafeDependentDecisionInput
    ) => Promise<ProviderReadResult<TypeSafeDecision>>;
    decideIndependent: (
      input: TypeSafeIndependentDecisionInput
    ) => Promise<ProviderReadResult<readonly TypeSafeDecision[]>>;
  }>;

const EMPTY_USAGE: ModelUsage = Object.freeze({
  billedAmountMicros: null,
  currency: null,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

function instantFrom(value: Date): UtcTimestamp {
  return parseUtcTimestamp(value.toISOString());
}

function isHoldOrSkip(decision: TypeSafeDecision): boolean {
  return decision.answer === null || decision.uncertainty === "HIGH";
}

function duplicateId(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
  }
  return undefined;
}

function finiteTokens(value: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  return 0;
}

function usageFrom(usage: {
  input_tokens: number;
  output_tokens: number;
}): ModelUsage {
  const inputTokens = finiteTokens(usage.input_tokens);
  const outputTokens = finiteTokens(usage.output_tokens);
  return Object.freeze({
    billedAmountMicros: null,
    currency: null,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  });
}

function modelVersionFrom(
  reported: string,
  fallback: ModelVersion
): ModelVersion {
  try {
    return parseModelVersion(reported);
  } catch {
    return fallback;
  }
}

function uncertaintyFrom(confidence: number): TypeSafeUncertainty {
  if (
    !(typeof confidence === "number" && Number.isFinite(confidence)) ||
    confidence < TYPESAFE_ADAPTER_LIMITS.holdBelowConfidence
  ) {
    return "HIGH";
  }
  if (confidence < TYPESAFE_ADAPTER_LIMITS.mediumBelowConfidence) {
    return "MEDIUM";
  }
  return "LOW";
}

function preserveEvidenceIds(
  evidence: readonly TypeSafeEvidence[],
  answer: TypeSafeChoice | null
): readonly EvidenceId[] {
  const selected = answer
    ? evidence.find((item) => item.evidenceId === answer.id)
    : undefined;
  if (selected) {
    return Object.freeze([selected.evidenceId]);
  }
  return Object.freeze(evidence.map((item) => item.evidenceId));
}

function holdDecision(input: {
  evaluatedAt: Date;
  evidence: readonly TypeSafeEvidence[];
  modelVersion: ModelVersion;
  question: TypeSafeQuestion;
  usage?: ModelUsage;
}): TypeSafeDecision {
  return Object.freeze({
    answer: null,
    answerEvidenceIds: preserveEvidenceIds(input.evidence, null),
    evaluatedAt: instantFrom(input.evaluatedAt),
    modelVersion: input.modelVersion,
    questionId: input.question.id,
    schemaVersion: input.question.schemaVersion,
    uncertainty: "HIGH",
    usage: input.usage ?? EMPTY_USAGE,
  });
}

function firstDecision(
  context: ProviderOperationContext,
  decisions: readonly TypeSafeDecision[]
): ProviderReadResult<TypeSafeDecision> {
  const [decision] = decisions;
  if (!decision) {
    return providerInvalidInput(
      context,
      "question",
      "decision request produced no answer"
    );
  }
  return providerSuccess(context, decision);
}

function retryAfterAt(
  retryAfterMs: number | undefined,
  evaluatedAt: Date
): UtcTimestamp | null {
  if (!(typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs))) {
    return null;
  }
  return instantFrom(
    new Date(evaluatedAt.getTime() + Math.max(0, retryAfterMs))
  );
}

function validateQuestionInput(
  context: ProviderOperationContext,
  evidence: readonly TypeSafeEvidence[],
  question: TypeSafeQuestion
): ProviderReadResult<never> | null {
  if (question.choices.length === 0) {
    return providerInvalidInput(
      context,
      "question.choices",
      "question must contain at least one choice"
    );
  }
  if (question.choices.length > TYPESAFE_LIMITS.maxQuestionChoices) {
    return providerInvalidInput(
      context,
      "question.choices",
      `question cannot contain more than ${TYPESAFE_LIMITS.maxQuestionChoices} choices`,
      "OUT_OF_BOUNDS"
    );
  }
  if (duplicateId(question.choices.map((option) => option.id))) {
    return providerInvalidInput(
      context,
      "question.choices",
      "question choices must use unique ids"
    );
  }
  if (question.choices.some((option) => option.id.trim().length === 0)) {
    return providerInvalidInput(
      context,
      "question.choices",
      "question choice ids must not be empty"
    );
  }
  if (question.prompt.length > TYPESAFE_LIMITS.maxPromptCharacters) {
    return providerInvalidInput(
      context,
      "question.prompt",
      `question prompt cannot exceed ${TYPESAFE_LIMITS.maxPromptCharacters} characters`,
      "OUT_OF_BOUNDS"
    );
  }
  if (evidence.length > TYPESAFE_LIMITS.maxEvidence) {
    return providerInvalidInput(
      context,
      "evidence",
      `evidence cannot contain more than ${TYPESAFE_LIMITS.maxEvidence} items`,
      "OUT_OF_BOUNDS"
    );
  }
  return null;
}

function mapQuestionDecision(
  question: TypeSafeQuestion,
  input: TypeSafeIndependentDecisionInput,
  result: SystemOneResult<Questions>,
  evaluatedAt: Date
): TypeSafeDecision {
  const usage = usageFrom(result.usage);
  const modelVersion = modelVersionFrom(result.model, input.modelVersion);
  const raw = result.answers[question.id];
  if (!raw || raw.type !== "choice") {
    return holdDecision({
      evaluatedAt,
      evidence: input.evidence,
      modelVersion,
      question,
      usage,
    });
  }
  const selected = question.choices.find((option) => option.id === raw.choice);
  if (!selected) {
    return holdDecision({
      evaluatedAt,
      evidence: input.evidence,
      modelVersion,
      question,
      usage,
    });
  }
  const uncertainty = uncertaintyFrom(raw.confidence);
  if (uncertainty === "HIGH") {
    return holdDecision({
      evaluatedAt,
      evidence: input.evidence,
      modelVersion,
      question,
      usage,
    });
  }
  return Object.freeze({
    answer: selected,
    answerEvidenceIds: preserveEvidenceIds(input.evidence, selected),
    evaluatedAt: instantFrom(evaluatedAt),
    modelVersion,
    questionId: question.id,
    schemaVersion: question.schemaVersion,
    uncertainty,
    usage,
  });
}

function mapSdkFailure(
  error: unknown,
  context: ProviderOperationContext,
  evaluatedAt: Date
): ProviderReadResult<never> {
  if (error instanceof RateLimitError) {
    return providerRetryableReadFailure(
      context,
      "RATE_LIMITED",
      "typesafe rate limit exceeded",
      retryAfterAt(error.retryAfterMs, evaluatedAt)
    );
  }
  if (error instanceof AuthenticationError) {
    return providerUnavailableCredentials(context, "TYPESAFE", "APPLICATION");
  }
  if (error instanceof PermissionDeniedError) {
    return providerDefinitiveRefusal(
      context,
      "CAPABILITY_UNAVAILABLE",
      "typesafe denied access to this model"
    );
  }
  if (error instanceof NotFoundError) {
    return providerDefinitiveRefusal(
      context,
      "NOT_FOUND",
      "typesafe model or endpoint was not found"
    );
  }
  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError
  ) {
    return providerInvalidInput(
      context,
      "question",
      "typesafe rejected the decision request"
    );
  }
  if (error instanceof APITimeoutError || error instanceof APIUserAbortError) {
    return providerRetryableReadFailure(
      context,
      "DEADLINE_EXCEEDED",
      "typesafe decision exceeded its deadline"
    );
  }
  if (error instanceof APIConnectionError) {
    return providerRetryableReadFailure(
      context,
      "UPSTREAM_READ_FAILURE",
      "typesafe connection failed"
    );
  }
  if (error instanceof APIError) {
    if (error.status === 429) {
      return providerRetryableReadFailure(
        context,
        "RATE_LIMITED",
        "typesafe rate limit exceeded"
      );
    }
    if (error.status >= 500) {
      return providerRetryableReadFailure(
        context,
        "TEMPORARY_UNAVAILABLE",
        "typesafe is temporarily unavailable"
      );
    }
    return providerRetryableReadFailure(
      context,
      "UPSTREAM_READ_FAILURE",
      "typesafe returned an unexpected error"
    );
  }
  if (error instanceof TypeSafeError) {
    return providerRetryableReadFailure(
      context,
      "UPSTREAM_READ_FAILURE",
      "typesafe request failed before a decision was available"
    );
  }
  return providerRetryableReadFailure(
    context,
    "UPSTREAM_READ_FAILURE",
    "typesafe request failed before a decision was available"
  );
}

async function decideQuestions(
  input: TypeSafeIndependentDecisionInput,
  priorDecisions: readonly TypeSafeDecision[],
  now: () => Date,
  loadClient: () => TypeSafeSystemOneClient | "CREDENTIALS_UNAVAILABLE"
): Promise<ProviderReadResult<readonly TypeSafeDecision[]>> {
  const evaluatedAt = now();
  const remainingMs =
    Date.parse(input.context.deadlineAt) - evaluatedAt.getTime();
  if (!(remainingMs > 0)) {
    return providerRetryableReadFailure(
      input.context,
      "DEADLINE_EXCEEDED",
      "typesafe decision deadline has already passed"
    );
  }

  const client = loadClient();
  if (client === "CREDENTIALS_UNAVAILABLE") {
    return providerUnavailableCredentials(
      input.context,
      "TYPESAFE",
      "APPLICATION"
    );
  }

  const timeoutMs = Math.max(
    1,
    Math.min(remainingMs, TYPESAFE_ADAPTER_LIMITS.maxTimeoutMs)
  );
  const maxRetries =
    remainingMs > timeoutMs
      ? Math.min(1, TYPESAFE_ADAPTER_LIMITS.maxRetries)
      : 0;

  try {
    const result = await client.systemOne(
      {
        model: input.modelVersion,
        questions: Object.fromEntries(
          input.questions.map((question) => [
            question.id,
            choice(
              question.prompt,
              Object.fromEntries(
                question.choices.map((option) => [option.id, option.label])
              )
            ),
          ])
        ),
        state: {
          evidence: input.evidence.map((item) => ({
            claim: item.claim,
            evidenceId: item.evidenceId,
          })),
          priorDecisions: priorDecisions.map((decision) => ({
            answerId: decision.answer?.id ?? null,
            questionId: decision.questionId,
            schemaVersion: decision.schemaVersion,
            uncertainty: decision.uncertainty,
          })),
          prospectId: input.prospectId,
          tenantId: input.tenantId,
        },
      },
      {
        headers: { "X-Correlation-Id": input.context.correlationId },
        retry: { maxRetries },
        signal: AbortSignal.timeout(remainingMs),
        timeout: timeoutMs,
      }
    );
    return providerSuccess(
      input.context,
      input.questions.map((question) =>
        mapQuestionDecision(question, input, result, evaluatedAt)
      )
    );
  } catch (error) {
    return mapSdkFailure(error, input.context, evaluatedAt);
  }
}

export function createTypeSafeDecisionPort(
  options: TypeSafeDecisionPortOptions = {}
): TypeSafeDecisionAdapter {
  const now = options.now ?? (() => new Date());
  const session = {
    client: options.client ?? null,
    missingCredentials: false,
  };

  const loadClient = ():
    | TypeSafeSystemOneClient
    | "CREDENTIALS_UNAVAILABLE" => {
    if (session.client) {
      return session.client;
    }
    if (session.missingCredentials) {
      return "CREDENTIALS_UNAVAILABLE";
    }
    try {
      session.client = new TypeSafeClient({
        apiKey: options.apiKey,
        fetch: options.fetch,
        logLevel: "off",
        retry: { maxRetries: TYPESAFE_ADAPTER_LIMITS.maxRetries },
        timeout: TYPESAFE_ADAPTER_LIMITS.maxTimeoutMs,
      });
      return session.client;
    } catch (error) {
      if (error instanceof TypeSafeError) {
        session.missingCredentials = true;
        return "CREDENTIALS_UNAVAILABLE";
      }
      throw error;
    }
  };

  const adapter: TypeSafeDecisionAdapter = {
    async decide(input) {
      const batch = await adapter.decideIndependent({
        context: input.context,
        evidence: input.evidence,
        modelVersion: input.modelVersion,
        prospectId: input.prospectId,
        questions: [input.question],
        tenantId: input.tenantId,
      });
      if (!batch.ok) {
        return batch;
      }
      return firstDecision(input.context, batch.value);
    },

    async decideDependent(input) {
      const invalid = validateQuestionInput(
        input.context,
        input.evidence,
        input.question
      );
      if (invalid) {
        return invalid;
      }
      if (input.priorDecisions.length === 0) {
        return providerInvalidInput(
          input.context,
          "priorDecisions",
          "dependent offer/angle decisions require at least one prior independent result"
        );
      }
      if (input.priorDecisions.some(isHoldOrSkip)) {
        return providerSuccess(
          input.context,
          holdDecision({
            evaluatedAt: now(),
            evidence: input.evidence,
            modelVersion: input.modelVersion,
            question: input.question,
          })
        );
      }
      const result = await decideQuestions(
        {
          context: input.context,
          evidence: input.evidence,
          modelVersion: input.modelVersion,
          prospectId: input.prospectId,
          questions: [input.question],
          tenantId: input.tenantId,
        },
        input.priorDecisions,
        now,
        loadClient
      );
      if (!result.ok) {
        return result;
      }
      return firstDecision(input.context, result.value);
    },

    async decideIndependent(input) {
      if (input.questions.length === 0) {
        return providerInvalidInput(
          input.context,
          "questions",
          "independent qualification/evidence requests need at least one question"
        );
      }
      for (const question of input.questions) {
        const invalid = validateQuestionInput(
          input.context,
          input.evidence,
          question
        );
        if (invalid) {
          return invalid;
        }
      }
      if (duplicateId(input.questions.map((question) => question.id))) {
        return providerInvalidInput(
          input.context,
          "questions",
          "independent questions must use unique ids"
        );
      }
      return await decideQuestions(input, [], now, loadClient);
    },
  };

  return Object.freeze(adapter);
}
