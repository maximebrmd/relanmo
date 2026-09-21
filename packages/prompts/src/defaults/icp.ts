import { ruleSource } from "./source";
import type { LeadAgentRuleSource } from "./source";

export const ICP_AUDIENCES = ["DECISION_MAKER", "RECRUITER_ESN"] as const;
export type IcpAudience = (typeof ICP_AUDIENCES)[number];

export const ICP_EXCLUSIONS = [
  "ON_MARKET_INTENT",
  "PEER_NOT_BUYER",
  "NOT_ICP",
] as const;
export type IcpExclusion = (typeof ICP_EXCLUSIONS)[number];

export type IcpProspectFacts = Readonly<{
  headline: string;
  observedSignalText: string | null;
}>;

export type IcpQualification =
  | Readonly<{
      audience: IcpAudience;
      eligible: true;
      exclusion: null;
      hiringSignalRequired: false;
      invitationAllowed: true;
      source: LeadAgentRuleSource;
    }>
  | Readonly<{
      audience: null;
      eligible: false;
      exclusion: IcpExclusion;
      hiringSignalRequired: false;
      invitationAllowed: false;
      source: LeadAgentRuleSource;
    }>;

const HUNT_ICP_SOURCE = ruleSource("hunt", "skills/hunt/SKILL.md");

const ON_MARKET_PHRASES = [
  "apply here",
  "besoin d'un dev",
  "besoin d'un prestataire",
  "cherche freelance",
  "cherche un dev",
  "cherche un freelance",
  "freelance accepté",
  "freelance bienvenu",
  "mission freelance",
  "mission urgente",
  "ouvert au freelance",
  "postulez ici",
  "qui connait un bon",
  "qui connait un freelance",
  "qui connaît un bon",
  "qui connaît un freelance",
] as const;

const RECRUITER_MARKERS = [
  "business developer",
  "esn",
  "it recruiter",
  "portage",
  "recruiter",
  "recruteur",
  "staffing",
  "talent acquisition",
  "talent partner",
  "talent sourcer",
] as const;

const PEER_MARKERS = [
  "as a service",
  "coach",
  "consultant",
  "cto on demand",
  "formateur",
  "fractional",
  "freelance",
  "independant",
  "indépendant",
  "interim",
  "mentor",
  "on demand",
] as const;

const DECISION_MAKER_MARKERS = [
  "ceo",
  "co-founder",
  "cofounder",
  "coo",
  "cpo",
  "cpto",
  "cto",
  "director",
  "engineering manager",
  "fondateur",
  "founder",
  "head of",
  "lead dev",
  "lead engineer",
  "tech lead",
  "vp eng",
  "vp engineering",
] as const;

function folded(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "");
}

function containsMarker(haystack: string, markers: readonly string[]): boolean {
  return markers.some((marker) => haystack.includes(folded(marker)));
}

/** Explicit on-market freelance-demand wording is a hard ICP exclusion. */
export function detectOnMarketIntent(signalText: string | null): boolean {
  if (signalText === null || signalText.trim().length === 0) {
    return false;
  }

  const lower = folded(signalText);
  if (ON_MARKET_PHRASES.some((phrase) => lower.includes(folded(phrase)))) {
    return true;
  }

  const freelanceDemand =
    lower.includes("freelance") &&
    (lower.includes("recrute") ||
      lower.includes("cherche") ||
      lower.includes("mission") ||
      lower.includes("besoin"));
  const asapMission =
    lower.includes("asap") &&
    (lower.includes("mission") || lower.includes("besoin"));
  return freelanceDemand || asapMission;
}

export function classifyIcpAudience(
  headline: string
): IcpAudience | "PEER_NOT_BUYER" | null {
  const lower = folded(headline);
  if (containsMarker(lower, PEER_MARKERS)) {
    return "PEER_NOT_BUYER";
  }
  if (containsMarker(lower, RECRUITER_MARKERS)) {
    return "RECRUITER_ESN";
  }
  if (containsMarker(lower, DECISION_MAKER_MARKERS)) {
    return "DECISION_MAKER";
  }
  return null;
}

/**
 * ICP match does not require a buying or hiring signal. Recruiters and ESN
 * staffing profiles are in-scope; on-market freelance demand and peer
 * freelancers are out.
 */
export function qualifyIcp(facts: IcpProspectFacts): IcpQualification {
  if (detectOnMarketIntent(facts.observedSignalText)) {
    return Object.freeze({
      audience: null,
      eligible: false,
      exclusion: "ON_MARKET_INTENT",
      hiringSignalRequired: false,
      invitationAllowed: false,
      source: HUNT_ICP_SOURCE,
    });
  }

  const classified = classifyIcpAudience(facts.headline);
  if (classified === "PEER_NOT_BUYER") {
    return Object.freeze({
      audience: null,
      eligible: false,
      exclusion: "PEER_NOT_BUYER",
      hiringSignalRequired: false,
      invitationAllowed: false,
      source: HUNT_ICP_SOURCE,
    });
  }

  if (classified === null) {
    return Object.freeze({
      audience: null,
      eligible: false,
      exclusion: "NOT_ICP",
      hiringSignalRequired: false,
      invitationAllowed: false,
      source: HUNT_ICP_SOURCE,
    });
  }

  return Object.freeze({
    audience: classified,
    eligible: true,
    exclusion: null,
    hiringSignalRequired: false,
    invitationAllowed: true,
    source: HUNT_ICP_SOURCE,
  });
}
