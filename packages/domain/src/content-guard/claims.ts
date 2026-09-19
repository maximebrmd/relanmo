import type { Evidence } from "../contracts/evidence";
import type { ProspectId, TenantId } from "../contracts/ids";
import type { ContentGuardClaim } from "./types";

export type ClaimFinding = Readonly<{
  code: "UNKNOWN_EVIDENCE" | "UNSUPPORTED_CLAIM" | "CLAIM_NOT_GROUNDED";
  detail: string;
}>;

const MIN_SIGNIFICANT_TOKEN_LENGTH = 4;
const MIN_STRONG_OVERLAP_COUNT = 2;
const MIN_STRONG_OVERLAP_RATIO = 0.6;
const DIACRITIC_PATTERN = /\p{Diacritic}/gu;
const WORD_PATTERN = /[a-z0-9]+/gu;

/**
 * Common French/English function words, pronouns and connectors that are
 * >= 4 characters and would otherwise pass the bare length floor. Without
 * this list, a false claim could share nothing but "votre" or "about" with
 * a real, correctly-scoped evidence record and still be counted as grounded.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "votre",
  "vos",
  "notre",
  "nos",
  "cette",
  "ceci",
  "cela",
  "pour",
  "vous",
  "avez",
  "avons",
  "sont",
  "soit",
  "etre",
  "avoir",
  "avec",
  "dans",
  "mais",
  "tout",
  "tous",
  "toute",
  "toutes",
  "comme",
  "alors",
  "aussi",
  "donc",
  "encore",
  "meme",
  "memes",
  "sans",
  "sous",
  "entre",
  "apres",
  "avant",
  "depuis",
  "ainsi",
  "elle",
  "elles",
  "ils",
  "leur",
  "leurs",
  "nous",
  "quand",
  "dont",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "deja",
  "about",
  "above",
  "after",
  "again",
  "against",
  "being",
  "below",
  "between",
  "could",
  "during",
  "having",
  "other",
  "should",
  "their",
  "there",
  "these",
  "those",
  "through",
  "under",
  "until",
  "where",
  "which",
  "while",
  "would",
  "your",
  "yours",
  "been",
  "were",
  "that",
  "this",
  "with",
  "from",
  "have",
  "will",
]);

/**
 * Lowercased, accent-stripped, stopword-filtered tokens of at least four
 * characters. The stopword list, not just the length floor, is load-bearing:
 * a shared connector/pronoun must never by itself count as shared content.
 */
function significantTokens(text: string): ReadonlySet<string> {
  const normalized = text.normalize("NFD").replace(DIACRITIC_PATTERN, "");
  const tokens = normalized.toLowerCase().match(WORD_PATTERN) ?? [];
  return new Set(
    tokens.filter(
      (token) =>
        token.length >= MIN_SIGNIFICANT_TOKEN_LENGTH && !STOPWORDS.has(token)
    )
  );
}

/**
 * A deterministic, non-semantic grounding floor: the claim's significant
 * tokens must overlap heavily with the cited evidence's own normalized
 * claim, not merely share one word. Grounded requires either every one of
 * the claim's significant tokens to appear in the evidence (a short claim
 * fully covered by it) or a strong overlap (at least two shared tokens
 * covering at least 60% of the claim's significant tokens). A single shared
 * token is never sufficient on its own once the claim has more than one
 * significant token: that was the exact gap a prior review caught (a false
 * claim citing a real, correctly-scoped evidence record while sharing only
 * a generic connector word such as "votre" or "about"). This cannot confirm
 * the claim is a faithful paraphrase of the evidence, but it does reject a
 * claim that cites a validly-scoped evidence record while asserting
 * something that record's content does not substantially support.
 */
function isGroundedInEvidence(
  claim: ContentGuardClaim,
  evidence: Evidence
): boolean {
  const claimTokens = significantTokens(claim.text);
  if (claimTokens.size === 0) {
    return false;
  }

  const evidenceTokens = significantTokens(evidence.normalizedClaim);
  let overlapCount = 0;
  for (const token of claimTokens) {
    if (evidenceTokens.has(token)) {
      overlapCount += 1;
    }
  }

  if (overlapCount === 0) {
    return false;
  }
  if (overlapCount === claimTokens.size) {
    return true;
  }

  const overlapRatio = overlapCount / claimTokens.size;
  return (
    overlapCount >= MIN_STRONG_OVERLAP_COUNT &&
    overlapRatio >= MIN_STRONG_OVERLAP_RATIO
  );
}

/**
 * Every claim's evidenceId must resolve to a record in the caller-supplied
 * approved-evidence list for this exact tenant/prospect pair, and the
 * claim's own text must be grounded in that record's normalized claim. This
 * never scans the draft's free text for facts beyond the cited claim/evidence
 * pair, so prospect-supplied content or an instruction embedded elsewhere in
 * the draft cannot manufacture a claim or a supporting evidence record. An
 * evidenceId absent from the approved list is UNKNOWN_EVIDENCE (the model
 * invented or was fed an ID we never issued for this send); an evidenceId
 * that resolves but belongs to a different tenant or prospect is
 * UNSUPPORTED_CLAIM (real evidence that does not license a claim about this
 * recipient); a resolved, correctly-scoped evidence record whose normalized
 * claim does not strongly overlap with the claim text is CLAIM_NOT_GROUNDED
 * (a valid citation attached to an unrelated or unsupported assertion).
 */
export function findClaimFindings(
  claims: readonly ContentGuardClaim[],
  evidence: readonly Evidence[],
  tenantId: TenantId,
  prospectId: ProspectId
): readonly ClaimFinding[] {
  const byId = new Map(evidence.map((entry) => [entry.evidenceId, entry]));
  const findings: ClaimFinding[] = [];

  for (const claim of claims) {
    const matched = byId.get(claim.evidenceId);
    if (matched === undefined) {
      findings.push({
        code: "UNKNOWN_EVIDENCE",
        detail: `claim cites evidence ${claim.evidenceId}, which is not among the approved evidence for this send`,
      });
      continue;
    }
    if (matched.tenantId !== tenantId || matched.prospectId !== prospectId) {
      findings.push({
        code: "UNSUPPORTED_CLAIM",
        detail: `claim cites evidence ${claim.evidenceId}, which does not belong to this tenant/prospect`,
      });
    }
    if (!isGroundedInEvidence(claim, matched)) {
      findings.push({
        code: "CLAIM_NOT_GROUNDED",
        detail: `claim "${claim.text}" does not strongly overlap with the normalized claim of cited evidence ${claim.evidenceId} ("${matched.normalizedClaim}")`,
      });
    }
  }

  return Object.freeze(findings);
}
