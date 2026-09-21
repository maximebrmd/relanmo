import type { SequenceStep } from "@relanmo/domain/contracts";

import type {
  BuyingSignalKind,
  Dm2FollowUpFact,
  Dm3FollowUpFact,
  Dm1Hook,
  IcpAudience,
  IcpExclusion,
  LeadAgentRuleSource,
  SignalRelevance,
} from "../src/defaults";
import { LEAD_AGENT_SKILLS_SOURCE, ruleSource } from "../src/defaults";

export type FixtureProspect = Readonly<{
  company: string;
  freelancerCraft: string;
  fullName: string;
  headline: string;
  incomingReply: string | null;
  observedSignalText: string | null;
}>;

export type FixtureDrafting = Readonly<{
  audience: IcpAudience;
  dm2Fact: Dm2FollowUpFact | null;
  dm3Fact: Dm3FollowUpFact | null;
  signalKind: BuyingSignalKind;
  signalRelevance: SignalRelevance;
  verifiedSharedConnection: string | null;
}>;

export type FixtureExpectedOutcome = Readonly<{
  continueAutomatedOutreach: boolean;
  dm1Hook: Dm1Hook | null;
  hiringSignalRequired: false;
  icpEligible: boolean;
  icpExclusion: IcpExclusion | null;
  invitationHasNote: boolean;
  ownership: "BOT_ELIGIBLE" | "HUMAN_OWNED";
  sequenceSteps: readonly SequenceStep[];
}>;

export type EvaluationFixture = Readonly<{
  drafting: FixtureDrafting;
  expected: FixtureExpectedOutcome;
  id: string;
  prospect: FixtureProspect;
  source: LeadAgentRuleSource;
  summary: string;
}>;

const FULL_SEQUENCE = Object.freeze([
  "INVITATION",
  "DM1",
  "DM2",
  "DM3",
  "DM4",
  "DM5",
] as const satisfies readonly SequenceStep[]);

const NO_SEQUENCE_STEPS: readonly SequenceStep[] = Object.freeze([]);

export const EVALUATION_FIXTURES: readonly EvaluationFixture[] = Object.freeze([
  Object.freeze({
    drafting: Object.freeze({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
    }),
    expected: Object.freeze({
      continueAutomatedOutreach: true,
      dm1Hook: "RECRUITMENT",
      hiringSignalRequired: false,
      icpEligible: true,
      icpExclusion: null,
      invitationHasNote: false,
      ownership: "BOT_ELIGIBLE",
      sequenceSteps: FULL_SEQUENCE,
    }),
    id: "decision-maker-hiring",
    prospect: Object.freeze({
      company: "Nordwave SaaS",
      freelancerCraft: "frontend",
      fullName: "Camille Moreau",
      headline: "CTO @ Nordwave SaaS",
      incomingReply: null,
      observedSignalText:
        "Offre publiée: Senior Frontend React/Next.js — CDI, équipe produit.",
    }),
    source: ruleSource("hunt", "skills/hunt/SKILL.md"),
    summary:
      "Decision-maker ICP with an in-domain hiring signal: invite without a note, DM1 recruitment hook, full sequence.",
  }),
  Object.freeze({
    drafting: Object.freeze({
      audience: "RECRUITER_ESN",
      dm2Fact: null,
      dm3Fact: null,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
    }),
    expected: Object.freeze({
      continueAutomatedOutreach: true,
      dm1Hook: "RECRUITMENT",
      hiringSignalRequired: false,
      icpEligible: true,
      icpExclusion: null,
      invitationHasNote: false,
      ownership: "BOT_ELIGIBLE",
      sequenceSteps: FULL_SEQUENCE,
    }),
    id: "recruiter-esn",
    prospect: Object.freeze({
      company: "Atelier Portage",
      freelancerCraft: "frontend",
      fullName: "Alexandra Petit",
      headline: "Tech Recruiter @ Atelier Portage (ESN)",
      incomingReply: null,
      observedSignalText:
        "Staffing d'un profil Senior Frontend React pour un client produit.",
    }),
    source: ruleSource("dm", "skills/dm/SKILL.md"),
    summary:
      "Recruiter/ESN ICP staffing an in-domain profile: same sequence, recruitment hook used as a staffing angle.",
  }),
  Object.freeze({
    drafting: Object.freeze({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
      signalKind: "NONE",
      signalRelevance: "ABSENT",
      verifiedSharedConnection: null,
    }),
    expected: Object.freeze({
      continueAutomatedOutreach: true,
      dm1Hook: "NEUTRAL",
      hiringSignalRequired: false,
      icpEligible: true,
      icpExclusion: null,
      invitationHasNote: false,
      ownership: "BOT_ELIGIBLE",
      sequenceSteps: FULL_SEQUENCE,
    }),
    id: "no-signal",
    prospect: Object.freeze({
      company: "Lumenor Studio",
      freelancerCraft: "frontend",
      fullName: "Jordan Leroy",
      headline: "VP Engineering @ Lumenor Studio",
      incomingReply: null,
      observedSignalText: null,
    }),
    source: ruleSource("hunt", "skills/hunt/references/scoring-detail.md"),
    summary:
      "ICP match with no buying signal or verified mutual: invitation still allowed, DM1 uses a fact-safe neutral opener.",
  }),
  Object.freeze({
    drafting: Object.freeze({
      audience: "DECISION_MAKER",
      dm2Fact: null,
      dm3Fact: null,
      signalKind: "HIRING",
      signalRelevance: "RELEVANT",
      verifiedSharedConnection: null,
    }),
    expected: Object.freeze({
      continueAutomatedOutreach: false,
      dm1Hook: null,
      hiringSignalRequired: false,
      icpEligible: true,
      icpExclusion: null,
      invitationHasNote: false,
      ownership: "HUMAN_OWNED",
      sequenceSteps: NO_SEQUENCE_STEPS,
    }),
    id: "historical-reply",
    prospect: Object.freeze({
      company: "Nordwave SaaS",
      freelancerCraft: "frontend",
      fullName: "Samira Benali",
      headline: "Head of Product @ Nordwave SaaS",
      incomingReply:
        "Merci Camille, on a déjà un prestataire sur ce sujet pour ce trimestre.",
      observedSignalText:
        "Offre Senior Frontend React publiée sur la page entreprise.",
    }),
    source: ruleSource("dm", "skills/dm/SKILL.md"),
    summary:
      "A stored inbound reply stops automated DM1–DM5 drafting; humans own the conversation.",
  }),
]);

export function evaluationFixtureById(
  id: EvaluationFixture["id"]
): EvaluationFixture {
  const found = EVALUATION_FIXTURES.find((fixture) => fixture.id === id);
  if (found === undefined) {
    throw new Error(`unknown evaluation fixture ${id}`);
  }
  return found;
}

export const FIXTURE_SOURCE_REVISION = LEAD_AGENT_SKILLS_SOURCE.revision;
