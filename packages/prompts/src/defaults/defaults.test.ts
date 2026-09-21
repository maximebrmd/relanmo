import { describe, expect, it } from "vitest";

import { qualifyIcp } from "./icp";
import {
  invitationHasNote,
  planFrenchSequence,
  plannedSequenceSteps,
  selectDm1Hook,
} from "./plan";
import { LEAD_AGENT_SKILLS_SOURCE } from "./source";
import {
  FRENCH_WRITING_DEFAULTS,
  MESSAGE_TEMPLATES,
  templateByHook,
} from "./templates";

describe("French prompt defaults", () => {
  it("records the reviewed lead-agent-skills revision on the versioned defaults", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
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
      dm2Fact: null,
      dm3Fact: null,
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
        dm2Fact: null,
        dm3Fact: null,
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
        dm2Fact: null,
        dm3Fact: null,
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
        dm2Fact: null,
        dm3Fact: null,
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
      dm2Fact: null,
      dm3Fact: null,
      incomingReplyPresent: false,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
    });

    expect(plan.kind).toBe("SEQUENCE");
    expect(plan.kind === "SEQUENCE" && plan.steps[0]?.template.hook).toBe(
      "RECRUITMENT"
    );
  });

  it("excludes solo service companies without an identifiable product", () => {
    const soloService = qualifyIcp({
      companyEvidence: {
        employeeCount: 1,
        hasIdentifiableProduct: false,
        kind: "SERVICES",
      },
      headline: "CTO & Founder @ Pixel Studio",
      observedSignalText: null,
    });
    const soloProduct = qualifyIcp({
      companyEvidence: {
        employeeCount: 1,
        hasIdentifiableProduct: true,
        kind: "PRODUCT",
      },
      headline: "CTO & Founder @ Lumenor Studio",
      observedSignalText: null,
    });

    expect(soloService.eligible).toBe(false);
    expect(soloService.exclusion).toBe("NOT_ICP");
    expect(soloService.invitationAllowed).toBe(false);
    expect(soloProduct.eligible).toBe(true);
    expect(soloProduct.audience).toBe("DECISION_MAKER");
  });

  it("excludes executives whose company is their own name", () => {
    for (const headline of [
      "Founder @ Maxime Bourmaud",
      "Founder @ Maxime Bourmaud | Product Advisor",
    ]) {
      const qualification = qualifyIcp({
        headline,
        observedSignalText: null,
        prospectName: "Maxime Bourmaud",
      });

      expect(qualification.eligible).toBe(false);
      expect(qualification.exclusion).toBe("NOT_ICP");
      expect(qualification.invitationAllowed).toBe(false);
    }
  });

  it("stops automated drafting when a historical reply is present", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
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
        headline: "Business Dev @ Nova ESN",
        observedSignalText: null,
      }).audience
    ).toBe("RECRUITER_ESN");
    expect(
      qualifyIcp({
        headline: "CEO @ Freelance.com",
        observedSignalText: null,
      }).audience
    ).toBe("DECISION_MAKER");
    expect(
      qualifyIcp({
        headline: "Healthcare Recruiter @ City Hospital",
        observedSignalText: null,
      }).eligible
    ).toBe(false);
    expect(
      qualifyIcp({
        headline: "Talent Acquisition @ Nova ESN",
        observedSignalText: null,
      }).audience
    ).toBe("RECRUITER_ESN");
  });

  it("requires identifiable company evidence for executive titles", () => {
    for (const headline of [
      "Founder",
      "CTO",
      "CEO @ ",
      "Founder @ Open to work",
      "Founder @ Open to new opportunities",
      "Founder @ Building my next venture",
      "CTO | Looking for opportunities",
      "CEO · Available",
      "Founder — En recherche",
      "CTO @ Startup",
    ]) {
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
    expect(
      qualifyIcp({
        headline: "Eng Manager @ Lumenor Studio",
        observedSignalText: null,
      }).audience
    ).toBe("DECISION_MAKER");
    expect(
      qualifyIcp({
        headline: "VP Eng @ Lumenor Studio",
        observedSignalText: null,
      }).audience
    ).toBe("DECISION_MAKER");
    expect(
      qualifyIcp({
        headline: "Founding Engineer @ Lumenor Studio",
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
      "Nous recrutons des développeurs freelances.",
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
      dm2Fact: {
        detail: null,
        fact: "une nouvelle offre data",
        kind: "OFFER",
        relevance: "RELEVANT",
      },
      dm3Fact: {
        detail: null,
        fact: "une nouvelle offre data",
        kind: "PRODUCT",
        relevance: "RELEVANT",
      },
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });
    const distinct = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2Fact: {
        detail: null,
        fact: "une nouvelle offre data",
        kind: "OFFER",
        relevance: "RELEVANT",
      },
      dm3Fact: {
        detail: null,
        fact: "la page de migration produit",
        kind: "PRODUCT",
        relevance: "RELEVANT",
      },
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });

    expect(repeated.kind === "SEQUENCE" && repeated.steps[1]?.template.hook).toBe(
      "DM2_OFFER"
    );
    expect(repeated.kind === "SEQUENCE" && repeated.steps[2]?.template.hook).toBe(
      "DM3_NEUTRAL"
    );
    expect(distinct.kind === "SEQUENCE" && distinct.steps[2]?.template.hook).toBe(
      "DM3_PRODUCT"
    );
  });

  it("uses neutral follow-ups for off-domain facts", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2Fact: {
        detail: null,
        fact: "offre Chargé de Support Client",
        kind: "OFFER",
        relevance: "OFF_DOMAIN",
      },
      dm3Fact: {
        detail: null,
        fact: "page du support client",
        kind: "PRODUCT",
        relevance: "OFF_DOMAIN",
      },
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });

    expect(plan.kind === "SEQUENCE" && plan.steps[1]?.template.hook).toBe(
      "DM2_NEUTRAL"
    );
    expect(plan.kind === "SEQUENCE" && plan.steps[2]?.template.hook).toBe(
      "DM3_NEUTRAL"
    );
  });

  it("keeps the no-signal follow-up sequence fact-free", () => {
    const plan = planFrenchSequence({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
      incomingReplyPresent: false,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    });

    expect(plan.kind).toBe("SEQUENCE");
    if (plan.kind === "SEQUENCE") {
      for (const step of plan.steps.slice(1)) {
        expect(step.template.body).not.toContain("{{priorFact}}");
      }
    }
  });

  it("exposes every approved reusable message variant", () => {
    expect(templateByHook("PROSPECT_POST").body).toContain("{{signalDetail}}");
    expect(templateByHook("INBOUND_COMMENT").step).toBe("DM1");
    expect(templateByHook("INBOUND_LIKE").step).toBe("DM1");
    expect(templateByHook("DM2_OFFER").step).toBe("DM2");
    expect(templateByHook("DM2_PROSPECT_POST").body).toContain("{{dm2Detail}}");
    expect(templateByHook("DM2_RELEASE").step).toBe("DM2");
    expect(templateByHook("DM3_PRODUCT").step).toBe("DM3");
    expect(templateByHook("DM3_SPEAKING").body).toContain("{{dm3Detail}}");
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
