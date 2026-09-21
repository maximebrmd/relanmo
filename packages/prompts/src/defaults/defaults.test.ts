import { describe, expect, it } from "vitest";

import { qualifyIcp } from "./icp";
import {
  invitationHasNote,
  planFrenchSequence,
  plannedSequenceSteps,
  selectDm1Hook,
} from "./plan";
import { LEAD_AGENT_SKILLS_SOURCE } from "./source";
import { FRENCH_WRITING_DEFAULTS, MESSAGE_TEMPLATES } from "./templates";

describe("French prompt defaults", () => {
  it("records the reviewed lead-agent-skills revision on the versioned defaults", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      hasNewFollowUpFact: false,
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
    });

    expect(LEAD_AGENT_SKILLS_SOURCE.revision).toBe(
      "f5060aac8dbf5550905d3c85f6099712d9f4cd8c"
    );
    expect(plan.promptVersion.kind).toBe("PROMPT_DEFAULT");
    expect(plan.promptVersion.id).toBe("prompt_default_fr_v1");
    expect(plan.promptVersion.createdAt).toBe(
      LEAD_AGENT_SKILLS_SOURCE.capturedAt
    );
  });

  it("covers the full invitation and DM1–DM5 sequence without a hiring signal", () => {
    const qualification = qualifyIcp({
      headline: "CTO @ Nordwave SaaS",
      observedSignalText: null,
    });
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      hasNewFollowUpFact: false,
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
    });

    expect(qualification.eligible).toBe(true);
    expect(qualification.hiringSignalRequired).toBe(false);
    expect(FRENCH_WRITING_DEFAULTS.hiringSignalRequiredForIcpMatch).toBe(false);
    expect(plan.kind).toBe("SEQUENCE");
    expect(plannedSequenceSteps(plan)).toEqual([
      "INVITATION",
      "DM1",
      "DM2",
      "DM3",
      "DM4",
      "DM5",
    ]);
    expect(invitationHasNote(plan)).toBe(false);
    expect(
      selectDm1Hook({
        audience: "DECISION_MAKER",
        hasNewFollowUpFact: false,
        incomingReplyPresent: false,
        signalKind: "NONE",
        signalRelevance: "ABSENT",
      })
    ).toBe("SHARED_CONNECTION");
  });

  it("keeps an off-domain hiring signal from becoming the DM1 hook", () => {
    expect(
      selectDm1Hook({
        audience: "DECISION_MAKER",
        hasNewFollowUpFact: false,
        incomingReplyPresent: false,
        signalKind: "HIRING",
        signalRelevance: "OFF_DOMAIN",
      })
    ).toBe("SHARED_CONNECTION");
  });

  it("uses the recruitment hook for a recruiter staffing an in-domain role", () => {
    const plan = planFrenchSequence({
      audience: "RECRUITER_ESN",
      hasNewFollowUpFact: false,
      incomingReplyPresent: false,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
    });

    expect(plan.kind).toBe("SEQUENCE");
    expect(plan).toMatchObject({
      kind: "SEQUENCE",
      recruiterStaffingAngle: true,
    });
    expect(plan.kind === "SEQUENCE" && plan.steps[0]?.template.hook).toBe(
      "RECRUITMENT"
    );
  });

  it("stops automated drafting when a historical reply is present", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      hasNewFollowUpFact: false,
      incomingReplyPresent: true,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
    });

    expect(plan.kind).toBe("STOPPED");
    expect(plan.continueAutomatedOutreach).toBe(false);
    expect(plannedSequenceSteps(plan)).toEqual([]);
  });

  it("excludes on-market freelance demand from ICP", () => {
    const qualification = qualifyIcp({
      headline: "CTO @ Nordwave SaaS",
      observedSignalText: "On cherche un freelance React ASAP",
    });

    expect(qualification.eligible).toBe(false);
    expect(qualification.exclusion).toBe("ON_MARKET_INTENT");
    expect(qualification.invitationAllowed).toBe(false);
  });

  it("keeps reusable templates free of browser and Excel operations", () => {
    const operational = [
      "openpyxl",
      "pipeline-leadgen",
      "linkedin.com/messaging",
      "col Z",
      "CAPTCHA",
    ];

    for (const template of MESSAGE_TEMPLATES) {
      const body = template.body.toLowerCase();
      for (const marker of operational) {
        expect(body.includes(marker.toLowerCase())).toBe(false);
      }
      expect(template.source.revision).toBe(LEAD_AGENT_SKILLS_SOURCE.revision);
    }
  });
});
