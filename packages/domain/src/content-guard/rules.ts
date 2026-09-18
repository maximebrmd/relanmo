import { findClaimFindings } from "./claims";
import { findConstraintFindings } from "./constraints";
import type {
  ContentGuardCheck,
  ContentGuardReason,
  ContentGuardReasonClass,
  ContentGuardReasonCode,
  ContentGuardResult,
} from "./types";
import { findVariableFindings } from "./variables";

/**
 * Pure deterministic content checks (P012).
 *
 * This module consumes an already-composed draft and its approved evidence,
 * and returns a deterministic PASS/RETRY/HOLD verdict. It performs no
 * database, network, model or clock access. User prompt text and prospect
 * content reach this module only as inert characters inside `draft.text`;
 * they are scanned by the same length/placeholder/phrase rules as any other
 * text and can never supply a claim, an evidence record or a control
 * override. A model's own judgment about a claim's validity is not
 * consulted here and cannot substitute for these checks.
 */

const DEFECT_CODES: ReadonlySet<ContentGuardReasonCode> = new Set([
  "EMPTY_TEXT",
  "TOO_SHORT",
  "TOO_LONG",
  "UNRESOLVED_VARIABLE",
  "LEAKED_PLACEHOLDER",
]);

function classify(code: ContentGuardReasonCode): ContentGuardReasonClass {
  return DEFECT_CODES.has(code) ? "DEFECT" : "HOLD";
}

function collectReasons(
  check: ContentGuardCheck
): readonly ContentGuardReason[] {
  const { constraints, draft, evidence, prospectId, tenantId } = check;

  const findings = [
    ...findConstraintFindings(draft.text, constraints),
    ...findVariableFindings(draft.text, constraints.knownVariableNames),
    ...findClaimFindings(draft.claims, evidence, tenantId, prospectId),
  ];

  return Object.freeze(
    findings.map((finding) =>
      Object.freeze({
        class: classify(finding.code),
        code: finding.code,
        detail: finding.detail,
      })
    )
  );
}

function buildResult(
  check: ContentGuardCheck,
  reasons: readonly ContentGuardReason[]
): ContentGuardResult {
  const base = {
    attemptNumber: check.attempt.attemptNumber,
    prospectId: check.prospectId,
    step: check.draft.step,
    tenantId: check.tenantId,
  };

  if (reasons.length === 0) {
    return Object.freeze({ ...base, outcome: "PASS", reasons: [] as const });
  }

  const hasHoldReason = reasons.some((reason) => reason.class === "HOLD");
  const attemptsExhausted =
    check.attempt.attemptNumber >= check.attempt.maxAttempts;

  if (!hasHoldReason && !attemptsExhausted) {
    // SAFETY: reasons.length > 0 was checked above, so this is non-empty.
    return Object.freeze({
      ...base,
      outcome: "RETRY",
      reasons: reasons as readonly [
        ContentGuardReason,
        ...ContentGuardReason[],
      ],
    });
  }

  // Only append the bounded-loop marker when exhaustion, not an explicit
  // grounding/policy violation, is what forced this HOLD: an already-present
  // HOLD reason fully explains why regeneration would not help.
  const holdReasons =
    attemptsExhausted && !hasHoldReason
      ? [
          ...reasons,
          Object.freeze({
            class: "HOLD" as const,
            code: "MAX_ATTEMPTS_EXCEEDED" as const,
            detail: `retryable defects persisted after ${check.attempt.attemptNumber} of ${check.attempt.maxAttempts} allowed attempt(s)`,
          }),
        ]
      : reasons;

  // SAFETY: holdReasons is derived from reasons, which is non-empty here.
  const nonEmptyHoldReasons = holdReasons as readonly [
    ContentGuardReason,
    ...ContentGuardReason[],
  ];

  return Object.freeze({
    ...base,
    outcome: "HOLD",
    reasons: Object.freeze(nonEmptyHoldReasons),
  });
}

/** Decide whether a composed draft may become a send candidate, with a reason for every refusal. */
export function evaluateContentGuard(
  check: ContentGuardCheck
): ContentGuardResult {
  return buildResult(check, collectReasons(check));
}
