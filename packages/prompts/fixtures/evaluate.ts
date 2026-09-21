import type { Dm1Hook } from "../src/defaults";
import {
  DM1_HOOKS,
  invitationHasNote,
  planFrenchSequence,
  plannedSequenceSteps,
  qualifyIcp,
} from "../src/defaults";
import type { EvaluationFixture, FixtureExpectedOutcome } from "./cases";

function dm1HookFromPlan(hook: string | undefined): Dm1Hook | null {
  return DM1_HOOKS.find((candidate) => candidate === hook) ?? null;
}

export function evaluateFixture(
  fixture: EvaluationFixture
): FixtureExpectedOutcome {
  const qualification = qualifyIcp({
    headline: fixture.prospect.headline,
    observedSignalText: fixture.prospect.observedSignalText,
    prospectName: fixture.prospect.fullName,
  });
  if (!qualification.eligible) {
    throw new Error(`fixture ${fixture.id} is not ICP eligible`);
  }
  const incomingReplyPresent = fixture.prospect.incomingReply !== null;
  const plan = planFrenchSequence({
    audience: qualification.audience,
    dm2Fact: fixture.drafting.dm2Fact,
    dm3Fact: fixture.drafting.dm3Fact,
    incomingReplyPresent,
    signalKind: fixture.drafting.signalKind,
    signalRelevance: fixture.drafting.signalRelevance,
    verifiedSharedConnection: fixture.drafting.verifiedSharedConnection,
  });

  return Object.freeze({
    continueAutomatedOutreach: plan.continueAutomatedOutreach,
    dm1Hook:
      plan.kind === "SEQUENCE"
        ? dm1HookFromPlan(plan.steps[0]?.template.hook)
        : null,
    hiringSignalRequired: false,
    icpEligible: qualification.eligible,
    icpExclusion: qualification.exclusion,
    invitationHasNote: invitationHasNote(plan),
    ownership: incomingReplyPresent ? "HUMAN_OWNED" : "BOT_ELIGIBLE",
    sequenceSteps: plannedSequenceSteps(plan),
  });
}
