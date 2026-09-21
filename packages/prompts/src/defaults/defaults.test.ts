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
      dm2NewFact: null,
      dm3DifferentAngleFact: null,
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
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
      dm2NewFact: null,
      dm3DifferentAngleFact: null,
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
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
        dm2NewFact: null,
        dm3DifferentAngleFact: null,
        incomingReplyPresent: false,
        signalKind: "NONE",
        signalRelevance: "ABSENT",
        verifiedSharedConnection: null,
      })
    ).toBe("NEUTRAL");
  });

  it("keeps an off-domain hiring signal from becoming the DM1 hook", () => {
    expect(
      selectDm1Hook({
        audience: "DECISION_MAKER",
        dm2NewFact: null,
        dm3DifferentAngleFact: null,
        incomingReplyPresent: false,
        signalKind: "HIRING",
        signalRelevance: "OFF_DOMAIN",
        verifiedSharedConnection: null,
      })
    ).toBe("NEUTRAL");
  });

  it("uses a shared-connection opener only when the mutual is verified", () => {
    expect(
      selectDm1Hook({
        audience: "DECISION_MAKER",
        dm2NewFact: null,
        dm3DifferentAngleFact: null,
        incomingReplyPresent: false,
        signalKind: "NONE",
        signalRelevance: "ABSENT",
        verifiedSharedConnection: "Morgan Dupont",
      })
    ).toBe("SHARED_CONNECTION");
  });

  it("uses the recruitment hook for a recruiter staffing an in-domain role", () => {
    const plan = planFrenchSequence({
      audience: "RECRUITER_ESN",
      dm2NewFact: null,
      dm3DifferentAngleFact: null,
      incomingReplyPresent: false,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
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
      dm2NewFact: null,
      dm3DifferentAngleFact: null,
      incomingReplyPresent: true,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
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

  it("keeps broad commercial titles outside the scoped ICP", () => {
    expect(
      qualifyIcp({
        headline: "Head of Sales @ Product SaaS",
        observedSignalText: null,
      }).eligible
    ).toBe(false);
    expect(
      qualifyIcp({
        headline: "Head of Sales @ Talent Acquisition SaaS",
        observedSignalText: null,
      }).eligible
    ).toBe(false);
    expect(
      qualifyIcp({
        headline: "Business Developer @ Product SaaS",
        observedSignalText: null,
      }).eligible
    ).toBe(false);
    expect(
      qualifyIcp({
        headline: "Business Developer @ Conseil ESN",
        observedSignalText: null,
      }).audience
    ).toBe("RECRUITER_ESN");
    expect(
      qualifyIcp({
        headline: "CEO @ Freelance.com",
        observedSignalText: null,
      }).audience
    ).toBe("DECISION_MAKER");
  });

  it("requires identifiable company evidence for executive titles", () => {
    for (const headline of ["Founder", "CTO", "CEO @ "]) {
      const qualification = qualifyIcp({
        headline,
        observedSignalText: null,
      });

      expect(qualification.eligible).toBe(false);
      expect(qualification.exclusion).toBe("NOT_ICP");
      expect(qualification.invitationAllowed).toBe(false);
    }

    expect(
      qualifyIcp({
        headline: "Founder @ Lumenor Studio",
        observedSignalText: null,
      }).audience
    ).toBe("DECISION_MAKER");
  });

  it("does not combine unrelated signal words into on-market intent", () => {
    const qualification = qualifyIcp({
      headline: "CTO @ Nordwave SaaS",
      observedSignalText:
        "Notre mission est d'aider les freelances à mieux recruter.",
    });

    expect(qualification.eligible).toBe(true);
    expect(qualification.exclusion).toBe(null);
  });

  it("excludes direct French searches for a freelance", () => {
    for (const observedSignalText of [
      "Nous recherchons un freelance React.",
      "À la recherche d'un freelance React.",
    ]) {
      const qualification = qualifyIcp({
        headline: "CTO @ Nordwave SaaS",
        observedSignalText,
      });

      expect(qualification.eligible).toBe(false);
      expect(qualification.exclusion).toBe("ON_MARKET_INTENT");
    }
  });

  it("requires a distinct step-specific fact for the DM3 angle", () => {
    const repeated = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2NewFact: "une nouvelle offre data",
      dm3DifferentAngleFact: "une nouvelle offre data",
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });
    const distinct = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2NewFact: "une nouvelle offre data",
      dm3DifferentAngleFact: "la page de migration produit",
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });

    expect(repeated.kind === "SEQUENCE" && repeated.steps[1]?.template.hook).toBe(
      "DM2_NEW_FACT"
    );
    expect(repeated.kind === "SEQUENCE" && repeated.steps[2]?.template.hook).toBe(
      "DM3_NEUTRAL"
    );
    expect(distinct.kind === "SEQUENCE" && distinct.steps[2]?.template.hook).toBe(
      "DM3_DIFFERENT_ANGLE"
    );
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
