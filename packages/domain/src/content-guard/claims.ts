import type { Evidence } from "../contracts/evidence";
import type { ProspectId, TenantId } from "../contracts/ids";
import type { ContentGuardClaim } from "./types";

export type ClaimFinding = Readonly<{
  code: "UNKNOWN_EVIDENCE" | "UNSUPPORTED_CLAIM" | "CLAIM_NOT_GROUNDED";
  detail: string;
}>;

const MIN_SIGNIFICANT_TOKEN_LENGTH = 4;
const DIACRITIC_PATTERN = /\p{Diacritic}/gu;
const WORD_PATTERN = /[a-z0-9]+/gu;

/**
 * Lowercased, accent-stripped tokens of at least four characters. Short
 * function/connector words (French and English alike) are filtered by this
 * length floor without needing a maintained stopword list.
 */
function significantTokens(text: string): ReadonlySet<string> {
  const normalized = text.normalize("NFD").replace(DIACRITIC_PATTERN, "");
  const tokens = normalized.toLowerCase().match(WORD_PATTERN) ?? [];
  return new Set(
    tokens.filter((token) => token.length >= MIN_SIGNIFICANT_TOKEN_LENGTH)
  );
}

/**
 * A deterministic, non-semantic grounding floor: the claim must share at
 * least one significant term with the evidence record's own normalized
 * claim. This cannot confirm the claim is a faithful paraphrase of the
 * evidence, but it does reject a claim that cites a validly-scoped evidence
 * record while asserting something that record says nothing about (e.g.
 * citing a hiring post to support an unrelated "we worked together before"
 * claim).
 */
function isGroundedInEvidence(
  claim: ContentGuardClaim,
  evidence: Evidence
): boolean {
  const claimTokens = significantTokens(claim.text);
  const evidenceTokens = significantTokens(evidence.normalizedClaim);
  for (const token of claimTokens) {
    if (evidenceTokens.has(token)) {
      return true;
    }
  }
  return false;
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
 * claim shares no significant term with the claim text is CLAIM_NOT_GROUNDED
 * (a valid citation attached to an unrelated assertion).
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
        detail: `claim "${claim.text}" shares no significant term with the normalized claim of cited evidence ${claim.evidenceId} ("${matched.normalizedClaim}")`,
      });
    }
  }

  return Object.freeze(findings);
}
