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
  companyEvidence?: IcpCompanyEvidence | null;
  headline: string;
  observedSignalText: string | null;
  prospectName?: string | null;
}>;

export type IcpCompanyEvidence = Readonly<{
  employeeCount: number | null;
  hasIdentifiableProduct: boolean;
  kind: "PRODUCT" | "SERVICES" | "UNKNOWN";
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
  /\brecrut\w*\b(?:\s+\S+){0,3}\s+\bfreelances?\b/u,
  /\brecherch\w*\b(?:\s+(?:activement|actuellement))?\s+(?:(?:un|une|des)\s+|d['’](?:un|une)\s+)?freelances?\b/u,
  /\b(?:besoin|mission)\b(?:\s+\S+){0,4}\s+\basap\b/u,
  /\basap\b(?:\s+\S+){0,4}\s+\b(?:besoin|mission)\b/u,
] as const;

const RECRUITER_ROLE_MARKERS = [
  "recruiter",
  "recruteur",
  "staffing",
  "talent acquisition",
  "talent partner",
  "talent sourcer",
] as const;

const TECH_RECRUITING_ROLE_MARKERS = [
  "informatique",
  "it",
  "tech",
  "technical",
] as const;

const RECRUITER_COMPANY_MARKERS = ["esn", "portage"] as const;

const BUSINESS_DEVELOPMENT_ROLE_MARKERS = [
  "business dev",
  "business developer",
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

const APPROVED_FUNCTIONAL_ROLE_MARKERS = [
  "eng manager",
  "founding engineer",
  "vp eng",
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

const COMPANY_EVIDENCE_FILLERS = new Set([
  "confidential",
  "ma societe",
  "my company",
  "new venture",
  "none",
  "project",
  "projet",
  "saas",
  "startup",
  "stealth",
  "stealth startup",
]);

const COMPANY_STATUS_PATTERNS = [
  /^a la recherche\b/u,
  /^available(?: for work| immediately| now)?$/u,
  /^(?:building|creating|developing|launching|making|working on)\b/u,
  /^disponible(?: immediatement| maintenant)?$/u,
  /^en recherche\b/u,
  /^looking for (?:a role|new )?(?:opportunities|opportunity|work)\b/u,
  /^(?:my|our) (?:next )?(?:company|product|project|startup|venture)\b/u,
  /^open (?:for|to) (?:new )?(?:opportunities|opportunity|work)\b/u,
  /^seeking (?:a role|new )?(?:opportunities|opportunity|work)\b/u,
] as const;

const HEADLINE_DELIMITER = /\s+(?:@|\||·|—)\s+/u;

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

function normalizedIdentity(value: string): string {
  return folded(value).replaceAll(/[^a-z0-9]+/gu, " ").trim();
}

function headlineCompany(headline: string): string | null {
  const delimiter = HEADLINE_DELIMITER.exec(headline);
  if (delimiter?.index === undefined) {
    return null;
  }

  const remainder = headline.slice(delimiter.index + delimiter[0].length);
  const nextDelimiter = HEADLINE_DELIMITER.exec(remainder);
  const company = (
    nextDelimiter?.index === undefined
      ? remainder
      : remainder.slice(0, nextDelimiter.index)
  ).trim();
  const normalized = normalizedIdentity(company);
  const hasProperNameLikeToken =
    /(?:^|[^\p{L}\p{N}])(?:\p{Lu}[\p{Ll}\p{M}][\p{L}\p{M}\p{N}.'’_-]*|[A-Z0-9]{2,})(?=$|[^\p{L}\p{N}])/u.test(
      company
    );
  if (
    normalized.length === 0 ||
    COMPANY_EVIDENCE_FILLERS.has(normalized) ||
    COMPANY_STATUS_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    !hasProperNameLikeToken
  ) {
    return null;
  }

  return normalized;
}

function headlineRole(headline: string): string {
  const lower = folded(headline);
  const delimiter = HEADLINE_DELIMITER.exec(lower);
  return delimiter?.index === undefined ? lower : lower.slice(0, delimiter.index);
}

function isExecutiveHeadline(headline: string): boolean {
  return containsMarker(
    headlineRole(headline),
    EXECUTIVE_DECISION_MAKER_MARKERS
  );
}

function isSoloServicesWithoutProduct(
  evidence: IcpCompanyEvidence | null | undefined
): boolean {
  return (
    evidence !== null &&
    evidence !== undefined &&
    (evidence.employeeCount === 0 || evidence.employeeCount === 1) &&
    evidence.kind === "SERVICES" &&
    !evidence.hasIdentifiableProduct
  );
}

function isProspectOwnNameCompany(facts: IcpProspectFacts): boolean {
  const company = headlineCompany(facts.headline);
  const prospectName =
    facts.prospectName === null || facts.prospectName === undefined
      ? ""
      : normalizedIdentity(facts.prospectName);
  return company !== null && prospectName.length > 0 && company === prospectName;
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
  const role = headlineRole(headline);
  if (containsMarker(role, PEER_MARKERS)) {
    return "PEER_NOT_BUYER";
  }
  if (
    (containsMarker(role, RECRUITER_ROLE_MARKERS) &&
      (containsMarker(role, TECH_RECRUITING_ROLE_MARKERS) ||
        containsMarker(lower, RECRUITER_COMPANY_MARKERS))) ||
    (containsMarker(role, BUSINESS_DEVELOPMENT_ROLE_MARKERS) &&
      containsMarker(lower, RECRUITER_COMPANY_MARKERS))
  ) {
    return "RECRUITER_ESN";
  }
  const isExecutive = containsMarker(role, EXECUTIVE_DECISION_MAKER_MARKERS);
  if (
    (isExecutive && headlineCompany(headline) !== null) ||
    containsMarker(role, APPROVED_FUNCTIONAL_ROLE_MARKERS) ||
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


  const isDisqualifiedExecutive =
    classified === "DECISION_MAKER" &&
    isExecutiveHeadline(facts.headline) &&
    (isSoloServicesWithoutProduct(facts.companyEvidence) ||
      isProspectOwnNameCompany(facts));
  if (isDisqualifiedExecutive) {
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
