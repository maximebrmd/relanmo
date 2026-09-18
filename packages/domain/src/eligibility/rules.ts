import type {
  EligibilityCheck,
  EligibilityReason,
  EligibilityReasonCode,
  EligibilitySnapshot,
  EligibilityResult,
} from "../contracts/eligibility";
import type {
  DefaultSequencePlan,
  SequenceStep,
  UtcTimestamp,
} from "../contracts/values";
import { DEFAULT_SEQUENCE_PLAN, SEQUENCE_STEPS } from "../contracts/values";
import type {
  CurrentVersionSet,
  DraftSourceVersions,
} from "../contracts/versions";

/**
 * Pure outbound eligibility rules (C1).
 *
 * This module consumes an authoritative EligibilityCheck snapshot supplied by the
 * caller and returns a deterministic EligibilityResult. It performs no database,
 * network, model or clock access: every fact, including "now", comes from the
 * snapshot. A model result never authorizes sending; the reasons below are the
 * only source of truth for allow/hold/deny.
 */

type ReasonSeverity = "DENY" | "HOLD";

type EligibilityVerdict = Readonly<{
  code: EligibilityReasonCode;
  detail: string;
  retryAt: UtcTimestamp | null;
  severity: ReasonSeverity;
}>;

function verdict(
  severity: ReasonSeverity,
  code: EligibilityReasonCode,
  detail: string,
  retryAt: UtcTimestamp | null = null
): EligibilityVerdict {
  return { code, detail, retryAt, severity };
}

const SEQUENCE_PLAN_BY_STEP: ReadonlyMap<
  SequenceStep,
  DefaultSequencePlan[number]
> = new Map(DEFAULT_SEQUENCE_PLAN.map((entry) => [entry.step, entry]));

/**
 * The next step this account/prospect pair may take, given steps already completed
 * (in any campaign). Bounded sequencing is per account/prospect, not per campaign,
 * so this also rejects a second campaign that targets a pair whose sequence has
 * already advanced: the requested step will not match the pair's next open step.
 */
function nextRequiredStep(
  completedSteps: readonly SequenceStep[]
): SequenceStep | null {
  const completed = new Set<SequenceStep>(completedSteps);
  for (const step of SEQUENCE_STEPS) {
    if (!completed.has(step)) {
      return step;
    }
  }
  return null;
}

function refMatches<
  Ref extends Readonly<{ id: string; kind: string; revision: number }>,
>(candidate: Ref | null, current: Ref | null): boolean {
  if (candidate === null || current === null) {
    return candidate === current;
  }
  return candidate.id === current.id && candidate.revision === current.revision;
}

/** Fields whose candidate (draft) version has drifted from the current version. */
function findVersionMismatches(
  candidate: DraftSourceVersions,
  current: CurrentVersionSet
): readonly string[] {
  const mismatches: string[] = [];
  if (!refMatches(candidate.profile, current.profile)) {
    mismatches.push("profile");
  }
  if (!refMatches(candidate.campaign, current.campaign)) {
    mismatches.push("campaign");
  }
  if (!refMatches(candidate.explicitStyle, current.explicitStyle)) {
    mismatches.push("explicitStyle");
  }
  if (
    !refMatches(candidate.acceptedInferredStyle, current.acceptedInferredStyle)
  ) {
    mismatches.push("acceptedInferredStyle");
  }
  if (!refMatches(candidate.defaultPrompt, current.defaultPrompt)) {
    mismatches.push("defaultPrompt");
  }
  if (candidate.model !== current.model) {
    mismatches.push("model");
  }
  return mismatches;
}

/**
 * Any incoming message, including an attachment-only reply, persists human
 * ownership ahead of any classification. Both signals are checked independently:
 * ownership.kind is the authoritative record, incomingMessageAt guards the short
 * window where the stop transaction recorded the message but the ownership
 * projection has not yet been read back. Suppression (opt-out) is a separate,
 * durable exclusion checked alongside them.
 */
function humanHandoverVerdicts(
  snapshot: EligibilitySnapshot
): readonly EligibilityVerdict[] {
  const verdicts: EligibilityVerdict[] = [];

  if (snapshot.incomingMessageAt !== null) {
    verdicts.push(
      verdict(
        "DENY",
        "INCOMING_MESSAGE",
        `incoming message observed at ${snapshot.incomingMessageAt}`
      )
    );
  }
  if (snapshot.ownership.kind === "HUMAN_OWNED") {
    verdicts.push(
      verdict(
        "DENY",
        "HUMAN_OWNED",
        `ownership held for reason ${snapshot.ownership.reason}`
      )
    );
  }
  if (snapshot.suppression !== null) {
    verdicts.push(
      verdict(
        "DENY",
        "SUPPRESSED",
        `suppressed for reason ${snapshot.suppression.reason}`
      )
    );
  }

  return verdicts;
}

/**
 * Account health, campaign activation and billing entitlement gate real
 * outbound sends; an unknown fact is treated the same as a failing one
 * (fail closed) rather than assumed to be fine.
 */
function accountCampaignBillingVerdicts(
  snapshot: EligibilitySnapshot
): readonly EligibilityVerdict[] {
  const verdicts: EligibilityVerdict[] = [];

  if (snapshot.accountHealthy !== true) {
    verdicts.push(
      verdict(
        "DENY",
        "ACCOUNT_UNHEALTHY",
        snapshot.accountHealthy === null
          ? "account health is unknown"
          : "account is reported unhealthy"
      )
    );
  }
  if (snapshot.campaignActive !== true) {
    verdicts.push(
      verdict(
        "DENY",
        "CAMPAIGN_INACTIVE",
        snapshot.campaignActive === null
          ? "campaign activation is unknown"
          : "campaign is not active"
      )
    );
  }
  if (snapshot.entitlementActive !== true) {
    verdicts.push(
      verdict(
        "DENY",
        "ENTITLEMENT_UNAVAILABLE",
        snapshot.entitlementActive === null
          ? "billing entitlement is unknown"
          : "billing entitlement is inactive"
      )
    );
  }

  return verdicts;
}

/**
 * The invitation carries no note and requires no acceptance yet; every direct
 * message step requires a confirmed acceptance and approved evidence for its
 * claims.
 */
function acceptanceAndEvidenceVerdicts(
  snapshot: EligibilitySnapshot,
  step: SequenceStep
): readonly EligibilityVerdict[] {
  const verdicts: EligibilityVerdict[] = [];

  const plan = SEQUENCE_PLAN_BY_STEP.get(step);
  const requiresAcceptance = plan?.requiresAcceptance ?? true;
  if (requiresAcceptance && snapshot.acceptance.accepted !== true) {
    verdicts.push(
      verdict(
        "DENY",
        "MISSING_ACCEPTANCE",
        snapshot.acceptance.accepted === null
          ? "acceptance is unknown"
          : "prospect has not accepted"
      )
    );
  }

  const requiresEvidence = step !== "INVITATION";
  if (requiresEvidence && snapshot.evidence.status !== "VALID") {
    verdicts.push(
      verdict(
        "DENY",
        "MISSING_EVIDENCE",
        `evidence status is ${snapshot.evidence.status}`
      )
    );
  }

  return verdicts;
}

/** The pending draft and its source versions must be current before sending. */
function draftVersionVerdicts(
  snapshot: EligibilitySnapshot
): readonly EligibilityVerdict[] {
  if (snapshot.draft.status !== "VALID") {
    return [
      verdict(
        "DENY",
        "STALE_VERSION",
        `draft status is ${snapshot.draft.status}`
      ),
    ];
  }
  if (snapshot.versions.candidate === null) {
    return [
      verdict(
        "DENY",
        "STALE_VERSION",
        "valid draft is missing its candidate source versions"
      ),
    ];
  }

  const mismatches = findVersionMismatches(
    snapshot.versions.candidate,
    snapshot.versions.current
  );
  if (mismatches.length > 0) {
    return [
      verdict(
        "DENY",
        "STALE_VERSION",
        `stale versions: ${mismatches.join(", ")}`
      ),
    ];
  }
  return [];
}

/**
 * Quota and unresolved uncertain sends are transient blockers: they are holds,
 * not permanent denials, because they can clear on their own as reservations
 * free up or a reconciliation confirms the prior send's outcome.
 */
function quotaAndUncertainSendVerdicts(
  snapshot: EligibilitySnapshot
): readonly EligibilityVerdict[] {
  const verdicts: EligibilityVerdict[] = [];

  if (snapshot.unresolvedUnknownActionIds.length > 0) {
    verdicts.push(
      verdict(
        "HOLD",
        "UNKNOWN_SEND",
        `${snapshot.unresolvedUnknownActionIds.length} unresolved uncertain send(s) pending reconciliation`
      )
    );
  }
  if (snapshot.quotaAvailable !== true) {
    verdicts.push(
      verdict(
        "HOLD",
        "QUOTA_UNAVAILABLE",
        snapshot.quotaAvailable === null
          ? "quota availability is unknown"
          : "quota is unavailable"
      )
    );
  }

  return verdicts;
}

/** The business window and due plan bound when a step may be sent. */
function schedulingVerdicts(
  snapshot: EligibilitySnapshot
): readonly EligibilityVerdict[] {
  const verdicts: EligibilityVerdict[] = [];

  if (snapshot.businessWindow === null) {
    verdicts.push(
      verdict(
        "HOLD",
        "RECONCILIATION_REQUIRED",
        "business window evaluation is missing"
      )
    );
  } else if (snapshot.businessWindow.status === "CLOSED") {
    verdicts.push(
      verdict(
        "HOLD",
        "OUTSIDE_SEND_WINDOW",
        "current time is outside the permitted send window",
        snapshot.businessWindow.nextOpenAt
      )
    );
  } else if (snapshot.businessWindow.status === "UNKNOWN") {
    verdicts.push(
      verdict(
        "HOLD",
        "RECONCILIATION_REQUIRED",
        "business window status is unknown"
      )
    );
  }

  if (snapshot.duePlan === null) {
    verdicts.push(
      verdict("HOLD", "RECONCILIATION_REQUIRED", "due plan is missing")
    );
  } else if (
    snapshot.duePlan.closureAt !== null &&
    snapshot.evaluatedAt >= snapshot.duePlan.closureAt
  ) {
    verdicts.push(
      verdict("DENY", "NO_ELIGIBLE_STEP", "sequence closure time has passed")
    );
  } else if (snapshot.evaluatedAt < snapshot.duePlan.earliestAt) {
    verdicts.push(
      verdict(
        "HOLD",
        "NOT_DUE",
        "earliest permitted send time has not arrived",
        snapshot.duePlan.earliestAt
      )
    );
  }

  return verdicts;
}

/**
 * Bounded, deterministic step sequencing. This also rejects a second campaign
 * that targets an account/prospect pair whose sequence already advanced: the
 * requested step will not match the pair's next open step.
 */
function stepSequencingVerdicts(
  snapshot: EligibilitySnapshot,
  step: SequenceStep
): readonly EligibilityVerdict[] {
  const expectedStep = nextRequiredStep(snapshot.completedSteps);
  if (expectedStep === null) {
    return [
      verdict(
        "DENY",
        "NO_ELIGIBLE_STEP",
        "all sequence steps are already completed"
      ),
    ];
  }
  if (expectedStep !== step) {
    return [
      verdict(
        "DENY",
        "NO_ELIGIBLE_STEP",
        `expected step ${expectedStep}, requested ${step}`
      ),
    ];
  }
  return [];
}

function collectVerdicts(
  check: EligibilityCheck
): readonly EligibilityVerdict[] {
  const { snapshot, step } = check;
  return [
    ...humanHandoverVerdicts(snapshot),
    ...accountCampaignBillingVerdicts(snapshot),
    ...acceptanceAndEvidenceVerdicts(snapshot, step),
    ...draftVersionVerdicts(snapshot),
    ...quotaAndUncertainSendVerdicts(snapshot),
    ...schedulingVerdicts(snapshot),
    ...stepSequencingVerdicts(snapshot, step),
  ];
}

function earliestRetryAt(
  verdicts: readonly EligibilityVerdict[]
): UtcTimestamp | null {
  let earliest: UtcTimestamp | null = null;
  for (const entry of verdicts) {
    if (
      entry.retryAt !== null &&
      (earliest === null || entry.retryAt < earliest)
    ) {
      earliest = entry.retryAt;
    }
  }
  return earliest;
}

function buildResult(
  check: EligibilityCheck,
  verdicts: readonly EligibilityVerdict[]
): EligibilityResult {
  const base = {
    accountId: check.accountId,
    campaignId: check.campaignId,
    evaluatedAt: check.snapshot.evaluatedAt,
    prospectId: check.prospectId,
    step: check.step,
    tenantId: check.tenantId,
  };

  if (verdicts.length === 0) {
    return Object.freeze({
      ...base,
      outcome: "ALLOWED",
      reasons: [] as const,
      retryAt: null,
    });
  }

  const reasons = Object.freeze(
    verdicts.map((entry) =>
      Object.freeze({
        code: entry.code,
        detail: entry.detail,
        observedAt: base.evaluatedAt,
      })
    )
  );
  // SAFETY: verdicts.length > 0 was checked above, so reasons is non-empty.
  const nonEmptyReasons = reasons as readonly [
    EligibilityReason,
    ...EligibilityReason[],
  ];

  if (verdicts.some((entry) => entry.severity === "DENY")) {
    return Object.freeze({
      ...base,
      outcome: "DENY",
      reasons: nonEmptyReasons,
      retryAt: null,
    });
  }

  return Object.freeze({
    ...base,
    outcome: "HOLD",
    reasons: nonEmptyReasons,
    retryAt: earliestRetryAt(verdicts),
  });
}

/** Decide whether an invite or follow-up is eligible, with a reason for every refusal. */
export function evaluateEligibility(
  check: EligibilityCheck
): EligibilityResult {
  return buildResult(check, collectVerdicts(check));
}
