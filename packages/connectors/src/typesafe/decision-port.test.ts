import { parseEvidenceId, parseUtcTimestamp } from "@relanmo/domain/contracts";
import type {
  ProviderReadResult,
  TypeSafeDecision,
  TypeSafeQuestion,
} from "@relanmo/domain/ports/providers";
import {
  TYPESAFE_LIMITS,
  typeSafeDecisionFixture,
  typeSafeDecisionInputFixture,
} from "@relanmo/domain/ports/providers";
import type { SystemOneRequest } from "@typesafe-ai/sdk";
import { InternalServerError } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";

import type { TypeSafeSystemOneClient } from "./decision-port";
import {
  createTypeSafeDecisionPort,
  TYPESAFE_ADAPTER_LIMITS,
} from "./decision-port";

const NOW = new Date("2026-09-17T10:00:00.000Z");

const evidenceSelectQuestion = {
  choices: [
    { id: "evidence_offer_1", label: "Offre observée" },
    { id: "NONE", label: "Aucun signal pertinent" },
  ],
  id: "evidence-select",
  prompt: "Quel signal observé est pertinent ?",
  schemaVersion: "evidence-v1",
} as const satisfies TypeSafeQuestion;

const offerQuestion = {
  choices: [
    { id: "offer_a", label: "Offre A" },
    { id: "none", label: "Aucune offre" },
  ],
  id: "offer-fit",
  prompt: "Quelle offre vérifiée convient ?",
  schemaVersion: "offer-v1",
} as const satisfies TypeSafeQuestion;

function choiceAnswer(choiceId: string, confidence: number) {
  return {
    choice: choiceId,
    confidence,
    probabilities: { [choiceId]: confidence },
    type: "choice" as const,
  };
}

function clientReturning(
  answers: Record<string, ReturnType<typeof choiceAnswer>>,
  onRequest?: (request: SystemOneRequest) => void
): TypeSafeSystemOneClient {
  return {
    systemOne(request) {
      onRequest?.(request);
      return Promise.resolve({
        answers,
        model: "jev-1.13.0",
        usage: { input_tokens: 80, output_tokens: 12 },
      });
    },
  };
}

function unusedClient(onCall: () => void): TypeSafeSystemOneClient {
  return {
    systemOne() {
      onCall();
      return Promise.reject(new Error("invalid input must not reach the SDK"));
    },
  };
}

function readValue<Value>(result: ProviderReadResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

describe("TypeSafe decision adapter", () => {
  it("returns a bounded choice with preserved evidence ids", async () => {
    const port = createTypeSafeDecisionPort({
      client: clientReturning({
        "icp-fit": choiceAnswer("SUITABLE", 0.9),
      }),
      now: () => NOW,
    });

    const decision = readValue(await port.decide(typeSafeDecisionInputFixture));

    expect(decision.answer?.id).toBe("SUITABLE");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(decision.uncertainty).toBe("LOW");
    expect(decision.modelVersion).toBe("jev-1.13.0");
    expect(decision.usage).toEqual({
      billedAmountMicros: null,
      currency: null,
      inputTokens: 80,
      outputTokens: 12,
      totalTokens: 92,
    });
    expect(Object.hasOwn(decision, "sendAuthorization")).toBe(false);
  });

  it("rejects an invalid enum answer and still preserves supplied evidence ids", async () => {
    const port = createTypeSafeDecisionPort({
      client: clientReturning({
        "icp-fit": choiceAnswer("FABRICATED_FIT", 0.99),
      }),
      now: () => NOW,
    });

    const decision = readValue(await port.decide(typeSafeDecisionInputFixture));

    expect(decision.answer).toBeNull();
    expect(decision.answer?.id).not.toBe("FABRICATED_FIT");
    expect(decision.uncertainty).toBe("HIGH");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
  });

  it("keeps only evidence ids that were supplied on the input", async () => {
    const port = createTypeSafeDecisionPort({
      client: clientReturning({
        "evidence-select": choiceAnswer("evidence_invented", 0.95),
      }),
      now: () => NOW,
    });

    const decision = readValue(
      await port.decide({
        ...typeSafeDecisionInputFixture,
        question: evidenceSelectQuestion,
      })
    );

    expect(decision.answer).toBeNull();
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(decision.answerEvidenceIds).not.toContain("evidence_invented");
  });

  it("selects a supplied evidence id when that is the bounded answer", async () => {
    const port = createTypeSafeDecisionPort({
      client: clientReturning({
        "evidence-select": choiceAnswer("evidence_offer_1", 0.88),
      }),
      now: () => NOW,
    });

    const decision = readValue(
      await port.decide({
        ...typeSafeDecisionInputFixture,
        question: evidenceSelectQuestion,
      })
    );

    expect(decision.answer?.id).toBe("evidence_offer_1");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
  });

  it("holds when confidence is below the act threshold", async () => {
    const port = createTypeSafeDecisionPort({
      client: clientReturning({
        "icp-fit": choiceAnswer("SUITABLE", 0.4),
      }),
      now: () => NOW,
    });

    const decision = readValue(await port.decide(typeSafeDecisionInputFixture));

    expect(decision.answer).toBeNull();
    expect(decision.uncertainty).toBe("HIGH");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
  });

  it("asks independent qualification and evidence questions in one request", async () => {
    let captured: SystemOneRequest | undefined;
    const port = createTypeSafeDecisionPort({
      client: clientReturning(
        {
          "evidence-select": choiceAnswer("evidence_offer_1", 0.86),
          "icp-fit": choiceAnswer("SUITABLE", 0.91),
        },
        (request) => {
          captured = request;
        }
      ),
      now: () => NOW,
    });

    const batch = readValue(
      await port.decideIndependent({
        context: typeSafeDecisionInputFixture.context,
        evidence: typeSafeDecisionInputFixture.evidence,
        modelVersion: typeSafeDecisionInputFixture.modelVersion,
        prospectId: typeSafeDecisionInputFixture.prospectId,
        questions: [
          typeSafeDecisionInputFixture.question,
          evidenceSelectQuestion,
        ],
        tenantId: typeSafeDecisionInputFixture.tenantId,
      })
    );
    const decisions = batch.decisions;

    const questionIds = Object.keys(captured?.questions ?? {});
    expect(questionIds).toHaveLength(2);
    expect(questionIds).toContain("evidence-select");
    expect(questionIds).toContain("icp-fit");
    expect(captured?.state).toMatchObject({
      evidence: [
        {
          claim: "L’entreprise recrute des développeurs.",
          evidenceId: "evidence_offer_1",
        },
      ],
    });
    expect(decisions.map((decision) => decision.questionId)).toEqual([
      "icp-fit",
      "evidence-select",
    ]);
    expect(decisions[0]?.answer?.id).toBe("SUITABLE");
    expect(decisions[1]?.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(batch.usage.totalTokens).toBe(92);
    expect(decisions.map((decision) => decision.usage.totalTokens)).toEqual([
      0, 0,
    ]);
  });

  it("rejects oversized batches, labels, claims and total payloads before calling TypeSafe", async () => {
    let called = 0;
    const port = createTypeSafeDecisionPort({
      client: unusedClient(() => {
        called += 1;
      }),
      now: () => NOW,
    });
    const base = {
      context: typeSafeDecisionInputFixture.context,
      evidence: typeSafeDecisionInputFixture.evidence,
      modelVersion: typeSafeDecisionInputFixture.modelVersion,
      prospectId: typeSafeDecisionInputFixture.prospectId,
      tenantId: typeSafeDecisionInputFixture.tenantId,
    };

    const tooManyQuestions = await port.decideIndependent({
      ...base,
      questions: Array.from(
        { length: TYPESAFE_ADAPTER_LIMITS.maxIndependentQuestions + 1 },
        (_, index) => ({
          ...typeSafeDecisionInputFixture.question,
          id: `question_${index}`,
        })
      ),
    });
    expect(tooManyQuestions.ok).toBe(false);

    const longLabel = await port.decideIndependent({
      ...base,
      questions: [
        {
          ...typeSafeDecisionInputFixture.question,
          choices: [
            {
              id: "SUITABLE",
              label: "x".repeat(
                TYPESAFE_ADAPTER_LIMITS.maxChoiceLabelCharacters + 1
              ),
            },
          ],
        },
      ],
    });
    expect(longLabel.ok).toBe(false);

    const longClaim = await port.decideIndependent({
      ...base,
      evidence: [
        {
          ...typeSafeDecisionInputFixture.evidence[0]!,
          claim: "x".repeat(
            TYPESAFE_ADAPTER_LIMITS.maxEvidenceClaimCharacters + 1
          ),
        },
      ],
      questions: [typeSafeDecisionInputFixture.question],
    });
    expect(longClaim.ok).toBe(false);

    const largePayload = await port.decideIndependent({
      ...base,
      evidence: Array.from(
        { length: TYPESAFE_LIMITS.maxEvidence },
        (_, index) => ({
          claim: "x".repeat(500),
          evidenceId: parseEvidenceId(`evidence_${index}`),
        })
      ),
      questions: [typeSafeDecisionInputFixture.question],
    });
    expect(largePayload.ok).toBe(false);
    expect(called).toBe(0);
  });

  it("fails closed on malformed model and usage metadata", async () => {
    for (const response of [
      {
        answers: { "icp-fit": choiceAnswer("SUITABLE", 0.9) },
        model: "",
        usage: { input_tokens: 80, output_tokens: 12 },
      },
      {
        answers: { "icp-fit": choiceAnswer("SUITABLE", 0.9) },
        model: "jev-1.13.0",
        usage: { input_tokens: -1, output_tokens: 12 },
      },
      {
        answers: { "icp-fit": choiceAnswer("SUITABLE", 0.9) },
        model: "jev-1.13.0",
        usage: { input_tokens: 1.5, output_tokens: 12 },
      },
    ]) {
      const port = createTypeSafeDecisionPort({
        client: { systemOne: () => Promise.resolve(response) },
        now: () => NOW,
      });
      const result = await port.decide(typeSafeDecisionInputFixture);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("RETRYABLE_READ_FAILURE");
      }
    }
  });

  it("skips dependent offer selection when a prior independent decision is a hold", async () => {
    let called = 0;
    const port = createTypeSafeDecisionPort({
      client: unusedClient(() => {
        called += 1;
      }),
      now: () => NOW,
    });

    const heldPrior: TypeSafeDecision = {
      ...typeSafeDecisionFixture,
      answer: null,
      uncertainty: "HIGH",
    };
    const decision = readValue(
      await port.decideDependent({
        ...typeSafeDecisionInputFixture,
        priorDecisions: [heldPrior],
        question: offerQuestion,
      })
    );

    expect(called).toBe(0);
    expect(decision.answer).toBeNull();
    expect(decision.uncertainty).toBe("HIGH");
    expect(decision.questionId).toBe("offer-fit");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
  });

  it("includes validated prior answers in dependent offer/angle state", async () => {
    let captured: SystemOneRequest | undefined;
    const port = createTypeSafeDecisionPort({
      client: clientReturning(
        {
          "offer-fit": choiceAnswer("offer_a", 0.84),
        },
        (request) => {
          captured = request;
        }
      ),
      now: () => NOW,
    });

    const decision = readValue(
      await port.decideDependent({
        ...typeSafeDecisionInputFixture,
        priorDecisions: [typeSafeDecisionFixture],
        question: offerQuestion,
      })
    );

    expect(captured?.state).toMatchObject({
      priorDecisions: [
        {
          answerId: "SUITABLE",
          questionId: "icp-fit",
          schemaVersion: "qualification-v1",
          uncertainty: "LOW",
        },
      ],
    });
    expect(decision.answer?.id).toBe("offer_a");
  });

  it("rejects empty, oversized and duplicate choice input before calling TypeSafe", async () => {
    let called = 0;
    const port = createTypeSafeDecisionPort({
      client: unusedClient(() => {
        called += 1;
      }),
      now: () => NOW,
    });

    const empty = await port.decide({
      ...typeSafeDecisionInputFixture,
      question: {
        ...typeSafeDecisionInputFixture.question,
        choices: [],
      },
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok && empty.kind === "INVALID_INPUT") {
      expect(empty.field).toBe("question.choices");
      expect(empty.code).toBe("MALFORMED_INPUT");
    }

    const tooMany = await port.decide({
      ...typeSafeDecisionInputFixture,
      question: {
        ...typeSafeDecisionInputFixture.question,
        choices: Array.from(
          { length: TYPESAFE_LIMITS.maxQuestionChoices + 1 },
          (_, index) => ({ id: `choice_${index}`, label: `Choice ${index}` })
        ),
      },
    });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok && tooMany.kind === "INVALID_INPUT") {
      expect(tooMany.code).toBe("OUT_OF_BOUNDS");
    }

    const longPrompt = await port.decide({
      ...typeSafeDecisionInputFixture,
      question: {
        ...typeSafeDecisionInputFixture.question,
        prompt: "x".repeat(TYPESAFE_LIMITS.maxPromptCharacters + 1),
      },
    });
    expect(longPrompt.ok).toBe(false);
    if (!longPrompt.ok && longPrompt.kind === "INVALID_INPUT") {
      expect(longPrompt.field).toBe("question.prompt");
    }

    const tooMuchEvidence = await port.decide({
      ...typeSafeDecisionInputFixture,
      evidence: Array.from(
        { length: TYPESAFE_LIMITS.maxEvidence + 1 },
        (_, index) => ({
          claim: `Claim ${index}`,
          evidenceId: parseEvidenceId(`evidence_${index}`),
        })
      ),
    });
    expect(tooMuchEvidence.ok).toBe(false);
    if (!tooMuchEvidence.ok && tooMuchEvidence.kind === "INVALID_INPUT") {
      expect(tooMuchEvidence.field).toBe("evidence");
    }

    expect(called).toBe(0);
  });

  it("treats access failure as hold/skip, not a fabricated positive result", async () => {
    const port = createTypeSafeDecisionPort({
      client: {
        systemOne() {
          return Promise.reject(
            new InternalServerError(500, {}, new Headers())
          );
        },
      },
      now: () => NOW,
    });

    const unavailable = createTypeSafeDecisionPort({
      now: () => NOW,
    });
    const missing = await unavailable.decide(typeSafeDecisionInputFixture);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.kind).toBe("UNAVAILABLE_CREDENTIALS");
    }

    const failed = await port.decide(typeSafeDecisionInputFixture);
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.kind).toBe("RETRYABLE_READ_FAILURE");
    }
    expect(failed.ok ? failed.value.answer?.id : "no-positive-answer").not.toBe(
      "SUITABLE"
    );
  });

  it("does not call TypeSafe after the operation deadline", async () => {
    let called = 0;
    const port = createTypeSafeDecisionPort({
      client: unusedClient(() => {
        called += 1;
      }),
      now: () => new Date("2026-09-17T10:06:00.000Z"),
    });

    const result = await port.decide(typeSafeDecisionInputFixture);
    expect(called).toBe(0);
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "RETRYABLE_READ_FAILURE") {
      expect(result.code).toBe("DEADLINE_EXCEEDED");
    }
  });
});

describe("TypeSafe SDK smoke (mocked transport, not French accuracy or live access)", () => {
  it("round-trips a Choice question through the official TypeSafeClient", async () => {
    let requestedPath = "";
    const fetchImpl = (input: string, init?: RequestInit) => {
      requestedPath = input;
      const parsed: unknown = JSON.parse(String(init?.body ?? "{}"));
      expect(parsed).toMatchObject({
        questions: { "icp-fit": { type: "choice" } },
      });
      return Promise.resolve(
        Response.json(
          {
            answers: {
              "icp-fit": {
                choice: "SUITABLE",
                confidence: 0.93,
                probabilities: { INSUFFICIENT: 0.07, SUITABLE: 0.93 },
                type: "choice",
              },
            },
            model: "jev-1.13.0",
            usage: { input_tokens: 40, output_tokens: 6 },
          },
          {
            headers: { "x-typesafe-request-id": "req_fixture_1" },
            status: 200,
          }
        )
      );
    };

    const port = createTypeSafeDecisionPort({
      apiKey: "test-key",
      fetch: fetchImpl,
      now: () => NOW,
    });
    const decision = readValue(await port.decide(typeSafeDecisionInputFixture));

    expect(requestedPath).toContain("/v1/systemone");
    expect(decision.answer?.id).toBe("SUITABLE");
    expect(decision.answerEvidenceIds).toEqual(["evidence_offer_1"]);
    expect(decision.evaluatedAt).toBe(
      parseUtcTimestamp("2026-09-17T10:00:00.000Z")
    );
  });
});
