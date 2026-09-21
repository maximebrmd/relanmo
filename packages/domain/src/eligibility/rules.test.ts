import { describe, expect, it } from "vitest";

import type {
  EligibilityCheck,
  EligibilityReasonCode,
} from "../contracts/eligibility";
import { eligibilityCheckFixture } from "../contracts/fixtures";
import { parseEligibilityCheck } from "../contracts/parsers";
import { DEFAULT_BUSINESS_WINDOW_CONFIGURATION } from "../contracts/values";
import { evaluateEligibility } from "./rules";

const FIXTURE_TIME = "2026-09-17T10:00:00.000Z";

/**
 * Raw (pre-parse) shapes mirroring the frozen C1 eligibility contract, used
 * only to build test inputs for `parseEligibilityCheck`. Kept concrete
 * (rather than a generic dictionary) so overrides stay checked against the
 * actual snapshot fields.
 */
type RawVersionRef = Readonly<{
  createdAt: string;
  id: string;
  kind: string;
  revision: number;
}>;

type RawVersions = Readonly<{
  acceptedInferredStyle: RawVersionRef | null;
  campaign: RawVersionRef;
  defaultPrompt: RawVersionRef;
  explicitStyle: RawVersionRef | null;
  model: string;
  profile: RawVersionRef | null;
  promptOverride: RawVersionRef | null;
}>;

type RawDuePlan = Readonly<{
  businessTimeZone: string;
  businessWindow: typeof DEFAULT_BUSINESS_WINDOW_CONFIGURATION;
  closureAt: string | null;
  earliestAt: string;
  intendedAt: string;
  step: string;
}>;

type RawSnapshot = Readonly<{
  acceptance: Readonly<{ accepted: boolean | null; observedAt: string | null }>;
  accountHealthy: boolean | null;
  businessWindow: Readonly<{
    nextOpenAt: string | null;
    status: string;
  }> | null;
  campaignActive: boolean | null;
  completedSteps: readonly string[];
  draft: Readonly<{ actionId: string | null; status: string }>;
  duePlan: RawDuePlan | null;
  entitlementActive: boolean | null;
  evaluatedAt: string;
  evidence: Readonly<{ evidenceIds: readonly string[]; status: string }>;
  incomingMessageAt: string | null;
  ownership: Readonly<{
    kind: string;
    ownerUserId: string | null;
    reason: string;
    recordedAt: string;
  }>;
  quotaAvailable: boolean | null;
  suppression: Readonly<{
    accountId: string;
    prospectId: string;
    reason: string;
    recordedAt: string;
    tenantId: string;
  }> | null;
  unresolvedUnknownActionIds: readonly string[];
  versions: Readonly<{ candidate: RawVersions | null; current: RawVersions }>;
}>;

type RawEligibilityCheck = Readonly<{
  accountId: string;
  campaignId: string;
  prospectId: string;
  snapshot: RawSnapshot;
  step: string;
  tenantId: string;
}>;

const VERSIONS: RawVersions = {
  acceptedInferredStyle: null,
  campaign: {
    createdAt: FIXTURE_TIME,
    id: "campaign_version_1",
    kind: "CAMPAIGN",
    revision: 1,
  },
  defaultPrompt: {
    createdAt: FIXTURE_TIME,
    id: "prompt_version_1",
    kind: "PROMPT_DEFAULT",
    revision: 1,
  },
  explicitStyle: null,
  model: "claude-sonnet-4-5",
  profile: null,
  promptOverride: null,
};

const STALE_VERSIONS: RawVersions = {
  ...VERSIONS,
  campaign: {
    ...VERSIONS.campaign,
    id: "campaign_version_2",
    revision: 2,
  },
};

const INVITATION_DUE_PLAN: RawDuePlan = {
  businessTimeZone: "Europe/Paris",
  businessWindow: DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  closureAt: null,
  earliestAt: FIXTURE_TIME,
  intendedAt: FIXTURE_TIME,
  step: "INVITATION",
};

const DM1_DUE_PLAN: RawDuePlan = { ...INVITATION_DUE_PLAN, step: "DM1" };

/** A first-step check: no acceptance/evidence required, nothing completed yet. */
const INVITATION_RAW_CHECK: RawEligibilityCheck = {
  accountId: "account_1",
  campaignId: "campaign_1",
  prospectId: "prospect_1",
  snapshot: {
    acceptance: { accepted: null, observedAt: null },
    accountHealthy: true,
    businessWindow: { nextOpenAt: null, status: "OPEN" },
    campaignActive: true,
    completedSteps: [],
    draft: { actionId: "action_invitation_1", status: "VALID" },
    duePlan: INVITATION_DUE_PLAN,
    entitlementActive: true,
    evaluatedAt: FIXTURE_TIME,
    evidence: { evidenceIds: [], status: "MISSING" },
    incomingMessageAt: null,
    ownership: {
      kind: "BOT_ELIGIBLE",
      ownerUserId: null,
      reason: "INITIAL_ACTIVATION",
      recordedAt: FIXTURE_TIME,
    },
    quotaAvailable: true,
    suppression: null,
    unresolvedUnknownActionIds: [],
    versions: { candidate: VERSIONS, current: VERSIONS },
  },
  step: "INVITATION",
  tenantId: "tenant_1",
};

/** A DM1 check for a pair that already completed the invitation and was accepted. */
const DM1_RAW_CHECK: RawEligibilityCheck = {
  ...INVITATION_RAW_CHECK,
  snapshot: {
    ...INVITATION_RAW_CHECK.snapshot,
    acceptance: { accepted: true, observedAt: FIXTURE_TIME },
    completedSteps: ["INVITATION"],
    draft: { actionId: "action_dm1_1", status: "VALID" },
    duePlan: DM1_DUE_PLAN,
    evidence: { evidenceIds: ["evidence_1"], status: "VALID" },
  },
  step: "DM1",
};

function buildCheck(
  base: RawEligibilityCheck,
  snapshotOverrides: Partial<RawSnapshot> = {},
  checkOverrides: Partial<Omit<RawEligibilityCheck, "snapshot">> = {}
): EligibilityCheck {
  return parseEligibilityCheck({
    ...base,
    ...checkOverrides,
    snapshot: { ...base.snapshot, ...snapshotOverrides },
  });
}

function reasonCodes(
  result: ReturnType<typeof evaluateEligibility>
): readonly EligibilityReasonCode[] {
  return result.reasons.map((reason) => reason.code);
}

describe("evaluateEligibility: clean allow", () => {
  it("allows a fresh invitation with no obstacles", () => {
    const result = evaluateEligibility(buildCheck(INVITATION_RAW_CHECK));
    expect(result.outcome).toBe("ALLOWED");
    expect(result.reasons).toHaveLength(0);
    expect(result.retryAt).toBeNull();
  });

  it("allows DM1 once the invitation is completed and accepted", () => {
    const result = evaluateEligibility(buildCheck(DM1_RAW_CHECK));
    expect(result.outcome).toBe("ALLOWED");
    expect(result.reasons).toHaveLength(0);
  });

  it("is a pure function: identical input yields identical output", () => {
    const check = buildCheck(DM1_RAW_CHECK);
    const first = evaluateEligibility(check);
    const second = evaluateEligibility(check);
    expect(first).toEqual(second);
  });

  it("evaluates the frozen C1 contract fixture deterministically", () => {
    const first = evaluateEligibility(eligibilityCheckFixture);
    const second = evaluateEligibility(eligibilityCheckFixture);
    expect(first).toEqual(second);
    expect(first.accountId).toBe(eligibilityCheckFixture.accountId);
    expect(first.step).toBe(eligibilityCheckFixture.step);
  });
});

describe("evaluateEligibility: human ownership and reply handover always deny", () => {
  it("denies on HUMAN_OWNED ownership", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        ownership: {
          kind: "HUMAN_OWNED",
          ownerUserId: "user_1",
          reason: "MANUAL_REPLY",
          recordedAt: FIXTURE_TIME,
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("HUMAN_OWNED");
    expect(result.retryAt).toBeNull();
  });

  it("denies on manual takeover ownership", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        ownership: {
          kind: "HUMAN_OWNED",
          ownerUserId: "user_1",
          reason: "MANUAL_TAKEOVER",
          recordedAt: FIXTURE_TIME,
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("HUMAN_OWNED");
  });

  it("denies on any incoming message, including an attachment-only reply", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { incomingMessageAt: FIXTURE_TIME })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("INCOMING_MESSAGE");
  });

  it("reports both signals when an incoming message has already flipped ownership", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        incomingMessageAt: FIXTURE_TIME,
        ownership: {
          kind: "HUMAN_OWNED",
          ownerUserId: null,
          reason: "INCOMING_MESSAGE",
          recordedAt: FIXTURE_TIME,
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("INCOMING_MESSAGE");
    expect(reasonCodes(result)).toContain("HUMAN_OWNED");
  });

  it("denies on suppression (opt-out)", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        suppression: {
          accountId: "account_1",
          prospectId: "prospect_1",
          reason: "PROSPECT_OBJECTION",
          recordedAt: FIXTURE_TIME,
          tenantId: "tenant_1",
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("SUPPRESSED");
  });
});

describe("evaluateEligibility: account, campaign and billing gates deny (fail closed)", () => {
  it.each([
    ["reported unhealthy", false],
    ["unknown", null],
  ])("denies when account health is %s", (_label, accountHealthy) => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { accountHealthy })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("ACCOUNT_UNHEALTHY");
  });

  it.each([
    ["inactive", false],
    ["unknown", null],
  ])("denies when campaign activation is %s", (_label, campaignActive) => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { campaignActive })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("CAMPAIGN_INACTIVE");
  });

  it.each([
    ["inactive/past-due", false],
    ["unknown", null],
  ])("denies when billing entitlement is %s", (_label, entitlementActive) => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { entitlementActive })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("ENTITLEMENT_UNAVAILABLE");
  });
});

describe("evaluateEligibility: acceptance and evidence", () => {
  it.each([
    ["declined", false],
    ["unknown", null],
  ])("denies DM1 when acceptance is %s", (_label, accepted) => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        acceptance: {
          accepted,
          observedAt: accepted === null ? null : FIXTURE_TIME,
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("MISSING_ACCEPTANCE");
  });

  it("does not require acceptance for the invitation step", () => {
    const result = evaluateEligibility(buildCheck(INVITATION_RAW_CHECK));
    expect(reasonCodes(result)).not.toContain("MISSING_ACCEPTANCE");
  });

  it.each(["MISSING", "INVALID", "UNKNOWN"] as const)(
    "denies DM1 when evidence status is %s",
    (status) => {
      const result = evaluateEligibility(
        buildCheck(DM1_RAW_CHECK, {
          evidence: { evidenceIds: [], status },
        })
      );
      expect(result.outcome).toBe("DENY");
      expect(reasonCodes(result)).toContain("MISSING_EVIDENCE");
    }
  );

  it("does not require evidence for the invitation step", () => {
    const result = evaluateEligibility(buildCheck(INVITATION_RAW_CHECK));
    expect(reasonCodes(result)).not.toContain("MISSING_EVIDENCE");
  });
});

describe("evaluateEligibility: draft and version currency", () => {
  it.each(["MISSING", "STALE", "INVALID", "UNKNOWN"] as const)(
    "denies when the draft status is %s",
    (status) => {
      const result = evaluateEligibility(
        buildCheck(DM1_RAW_CHECK, {
          draft: {
            actionId: status === "MISSING" ? null : "action_dm1_1",
            status,
          },
        })
      );
      expect(result.outcome).toBe("DENY");
      expect(reasonCodes(result)).toContain("STALE_VERSION");
    }
  );

  it("denies when the candidate versions no longer match current versions", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        versions: { candidate: STALE_VERSIONS, current: VERSIONS },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("STALE_VERSION");
  });

  it("denies when the campaign prompt override version is stale", () => {
    const currentOverride = {
      createdAt: FIXTURE_TIME,
      id: "prompt_override_version_2",
      kind: "PROMPT_OVERRIDE",
      revision: 2,
    };
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        versions: {
          candidate: {
            ...VERSIONS,
            promptOverride: {
              ...currentOverride,
              id: "prompt_override_version_1",
              revision: 1,
            },
          },
          current: { ...VERSIONS, promptOverride: currentOverride },
        },
      })
    );

    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("STALE_VERSION");
  });
});

describe("evaluateEligibility: bounded step sequencing", () => {
  it("denies once all sequence steps are completed", () => {
    const result = evaluateEligibility(
      buildCheck(
        DM1_RAW_CHECK,
        {
          completedSteps: ["INVITATION", "DM1", "DM2", "DM3", "DM4", "DM5"],
          duePlan: { ...DM1_DUE_PLAN, step: "DM5" },
        },
        { step: "DM5" }
      )
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("NO_ELIGIBLE_STEP");
  });

  it("denies an out-of-order step request", () => {
    const result = evaluateEligibility(
      buildCheck(
        DM1_RAW_CHECK,
        {
          completedSteps: ["INVITATION"],
          draft: { actionId: "action_dm3_1", status: "VALID" },
          duePlan: { ...DM1_DUE_PLAN, step: "DM3" },
        },
        { step: "DM3" }
      )
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("NO_ELIGIBLE_STEP");
  });

  it("denies a second campaign reusing an account/prospect pair whose sequence already advanced", () => {
    // The pair already has a completed invitation (and beyond) from a first
    // campaign; a second campaign requesting the invitation step again for the
    // same account/prospect pair must be denied, not restart the sequence.
    const result = evaluateEligibility(
      buildCheck(
        INVITATION_RAW_CHECK,
        {
          completedSteps: ["INVITATION", "DM1"],
        },
        { campaignId: "campaign_2" }
      )
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("NO_ELIGIBLE_STEP");
  });
});

describe("evaluateEligibility: scheduling holds", () => {
  it("holds when the earliest permitted send time has not arrived", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        duePlan: {
          ...DM1_DUE_PLAN,
          earliestAt: "2026-09-18T10:00:00.000Z",
        },
      })
    );
    expect(result.outcome).toBe("HOLD");
    expect(reasonCodes(result)).toContain("NOT_DUE");
    expect(result.retryAt).toBe("2026-09-18T10:00:00.000Z");
  });

  it("holds outside the permitted business window and reports the reopen time", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        businessWindow: {
          nextOpenAt: "2026-09-18T08:00:00.000Z",
          status: "CLOSED",
        },
      })
    );
    expect(result.outcome).toBe("HOLD");
    expect(reasonCodes(result)).toContain("OUTSIDE_SEND_WINDOW");
    expect(result.retryAt).toBe("2026-09-18T08:00:00.000Z");
  });

  it("picks the latest retry time when multiple scheduling holds apply", () => {
    // Retrying at the earlier constraint (NOT_DUE's earliestAt) would still be
    // re-held by the business window, which only opens later: the reported
    // retryAt must be the latest (maximum) of the active timed holds.
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        businessWindow: {
          nextOpenAt: "2026-09-20T08:00:00.000Z",
          status: "CLOSED",
        },
        duePlan: {
          ...DM1_DUE_PLAN,
          earliestAt: "2026-09-19T10:00:00.000Z",
        },
      })
    );
    expect(result.outcome).toBe("HOLD");
    expect(result.retryAt).toBe("2026-09-20T08:00:00.000Z");
  });

  it("computes a retry time that clears every simultaneous timed hold", () => {
    const nextOpenAt = "2026-09-20T08:00:00.000Z";
    const earliestAt = "2026-09-19T10:00:00.000Z";

    const heldResult = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        businessWindow: { nextOpenAt, status: "CLOSED" },
        duePlan: { ...DM1_DUE_PLAN, earliestAt },
      })
    );
    expect(heldResult.outcome).toBe("HOLD");
    expect(heldResult.retryAt).toBe(nextOpenAt);

    // A single retry exactly at the reported time, with the window now open,
    // clears both the due-time and business-window constraints at once.
    const retriedResult = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        businessWindow: { nextOpenAt: null, status: "OPEN" },
        duePlan: { ...DM1_DUE_PLAN, earliestAt },
        evaluatedAt: nextOpenAt,
      })
    );
    expect(retriedResult.outcome).toBe("ALLOWED");
  });

  it.each([
    ["unavailable", false],
    ["unknown", null],
  ])("holds when quota is %s", (_label, quotaAvailable) => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { quotaAvailable })
    );
    expect(result.outcome).toBe("HOLD");
    expect(reasonCodes(result)).toContain("QUOTA_UNAVAILABLE");
  });

  it("holds pending reconciliation of an unresolved uncertain send", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        unresolvedUnknownActionIds: ["action_dm1_unknown"],
      })
    );
    expect(result.outcome).toBe("HOLD");
    expect(reasonCodes(result)).toContain("UNKNOWN_SEND");
    expect(result.retryAt).toBeNull();
  });

  it.each([
    ["missing", null],
    ["unknown", { nextOpenAt: null, status: "UNKNOWN" as const }],
  ])(
    "holds for reconciliation when the business window is %s",
    (_label, businessWindow) => {
      const result = evaluateEligibility(
        buildCheck(DM1_RAW_CHECK, { businessWindow })
      );
      expect(result.outcome).toBe("HOLD");
      expect(reasonCodes(result)).toContain("RECONCILIATION_REQUIRED");
    }
  );

  it("holds for reconciliation when the due plan is missing", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, { duePlan: null })
    );
    expect(result.outcome).toBe("HOLD");
    expect(reasonCodes(result)).toContain("RECONCILIATION_REQUIRED");
  });

  it("denies once the sequence closure time has passed", () => {
    const result = evaluateEligibility(
      buildCheck(DM1_RAW_CHECK, {
        duePlan: {
          ...DM1_DUE_PLAN,
          closureAt: FIXTURE_TIME,
        },
      })
    );
    expect(result.outcome).toBe("DENY");
    expect(reasonCodes(result)).toContain("NO_ELIGIBLE_STEP");
  });
});
