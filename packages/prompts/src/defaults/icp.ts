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

const ON_MARKET_PATTERNS = [
  /\brecrut\w*\b(?:\s+\S+){0,3}\s+\bfreelance\b/u,
  /\b(?:besoin|mission)\b(?:\s+\S+){0,4}\s+\basap\b/u,
  /\basap\b(?:\s+\S+){0,4}\s+\b(?:besoin|mission)\b/u,
] as const;

const RECRUITER_ROLE_MARKERS = [
  "it recruiter",
  "recruiter",
  "recruteur",
  "staffing",
  "talent acquisition",
  "talent partner",
  "talent sourcer",
] as const;

const RECRUITER_COMPANY_MARKERS = ["esn", "portage"] as const;

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

const EXECUTIVE_DECISION_MAKER_MARKERS = [
  "ceo",
  "co-founder",
  "cofounder",
  "coo",
  "cpo",
  "cpto",
  "cto",
  "fondateur",
  "founder",
] as const;

const FUNCTIONAL_LEADERSHIP_MARKERS = [
  "director",
  "directeur",
  "directrice",
  "head of",
  "lead",
  "manager",
  "vice president",
  "vp",
] as const;

const TARGET_FUNCTION_MARKERS = [
  "data",
  "design",
  "dev",
  "digital",
  "engineering",
  "growth",
  "produit",
  "product",
  "software",
  "tech",
  "technology",
] as const;

function folded(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "");
}

function containsMarker(haystack: string, markers: readonly string[]): boolean {
  return markers.some((marker) => {
    const escaped = folded(marker).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
  });
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

  return ON_MARKET_PATTERNS.some((pattern) => pattern.test(lower));
}

export function classifyIcpAudience(
  headline: string
): IcpAudience | "PEER_NOT_BUYER" | null {
  const lower = folded(headline);
  const role = lower.split(/\s+(?:@|\||·|—)\s+/u, 1)[0] ?? lower;
  if (containsMarker(lower, PEER_MARKERS)) {
    return "PEER_NOT_BUYER";
  }
  if (
    containsMarker(lower, RECRUITER_ROLE_MARKERS) ||
    (containsMarker(lower, ["business developer"]) &&
      containsMarker(lower, RECRUITER_COMPANY_MARKERS))
  ) {
    return "RECRUITER_ESN";
  }
  if (
    containsMarker(lower, EXECUTIVE_DECISION_MAKER_MARKERS) ||
    (containsMarker(role, FUNCTIONAL_LEADERSHIP_MARKERS) &&
      containsMarker(role, TARGET_FUNCTION_MARKERS))
  ) {
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
