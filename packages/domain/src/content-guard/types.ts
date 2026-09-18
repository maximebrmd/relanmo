import type { Evidence } from "../contracts/evidence";
import type { EvidenceId, ProspectId, TenantId } from "../contracts/ids";
import type { DirectMessageStep } from "../contracts/values";

/**
 * A factual claim the composed draft makes about the prospect, tied to the
 * evidence record it is grounded in. The caller that composed the draft
 * (prompt composition, not this module) populates this list; content-guard
 * checks the citation against approved evidence, it never re-derives claims
 * by parsing the free-text draft.
 */
export type ContentGuardClaim = Readonly<{
  evidenceId: EvidenceId;
  text: string;
}>;

export type ContentGuardDraft = Readonly<{
  claims: readonly ContentGuardClaim[];
  step: DirectMessageStep;
  text: string;
}>;

/**
 * Deterministic, campaign-specific bounds. Length bounds count characters in
 * the final rendered text; `knownVariableNames` is the exact set of template
 * variables the composer was allowed to substitute, used only to label a
 * leftover placeholder as an unresolved known variable versus an unrecognized
 * (leaked) one. Neither list requires a minimum number of grounded claims:
 * a neutral draft with zero claims is valid wherever the campaign does not
 * itself require a prospect signal.
 */
export type ContentGuardConstraints = Readonly<{
  forbiddenPhrases: readonly string[];
  knownVariableNames: readonly string[];
  maxLength: number;
  minLength: number;
}>;

/** Bounds the regeneration loop: attempts are 1-based and capped by maxAttempts. */
export type ContentGuardAttempt = Readonly<{
  attemptNumber: number;
  maxAttempts: number;
}>;

export type ContentGuardCheck = Readonly<{
  attempt: ContentGuardAttempt;
  constraints: ContentGuardConstraints;
  draft: ContentGuardDraft;
  /**
   * Evidence approved for this exact tenant/prospect pair. This is the only
   * source a claim's evidenceId may resolve against; free text in the draft
   * or in prospect-supplied content is never treated as evidence.
   */
  evidence: readonly Evidence[];
  prospectId: ProspectId;
  tenantId: TenantId;
}>;

export const CONTENT_GUARD_REASON_CODES = [
  "EMPTY_TEXT",
  "TOO_SHORT",
  "TOO_LONG",
  "UNRESOLVED_VARIABLE",
  "LEAKED_PLACEHOLDER",
  "FORBIDDEN_PHRASE",
  "UNKNOWN_EVIDENCE",
  "UNSUPPORTED_CLAIM",
  "MAX_ATTEMPTS_EXCEEDED",
] as const;
export type ContentGuardReasonCode =
  (typeof CONTENT_GUARD_REASON_CODES)[number];

/**
 * DEFECT reasons are deterministic generation/formatting mistakes a bounded
 * regeneration attempt can plausibly fix (length, unresolved or leaked
 * placeholder syntax). HOLD reasons are grounding or policy violations
 * (unsupported claims, forbidden phrases): retrying with the same evidence
 * would not fix them, so they never resolve to a bare RETRY outcome.
 */
export const CONTENT_GUARD_REASON_CLASSES = ["DEFECT", "HOLD"] as const;
export type ContentGuardReasonClass =
  (typeof CONTENT_GUARD_REASON_CLASSES)[number];

export type ContentGuardReason = Readonly<{
  class: ContentGuardReasonClass;
  code: ContentGuardReasonCode;
  detail: string;
}>;

export const CONTENT_GUARD_OUTCOMES = ["PASS", "RETRY", "HOLD"] as const;
export type ContentGuardOutcome = (typeof CONTENT_GUARD_OUTCOMES)[number];

type ContentGuardBase = Readonly<{
  attemptNumber: number;
  prospectId: ProspectId;
  step: DirectMessageStep;
  tenantId: TenantId;
}>;

/** This pure result reports content-guard reasons; it never authorizes a send. */
export type ContentGuardResult =
  | Readonly<
      ContentGuardBase & {
        outcome: "PASS";
        reasons: readonly [];
      }
    >
  | Readonly<
      ContentGuardBase & {
        outcome: "RETRY";
        reasons: readonly [ContentGuardReason, ...ContentGuardReason[]];
      }
    >
  | Readonly<
      ContentGuardBase & {
        outcome: "HOLD";
        reasons: readonly [ContentGuardReason, ...ContentGuardReason[]];
      }
    >;
