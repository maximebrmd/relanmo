import type { Evidence } from "../contracts/evidence";
import type { ProspectId, TenantId } from "../contracts/ids";
import type { ContentGuardClaim } from "./types";

export type ClaimFinding = Readonly<{
  code: "UNKNOWN_EVIDENCE" | "UNSUPPORTED_CLAIM";
  detail: string;
}>;

/**
 * Every claim's evidenceId must resolve to a record in the caller-supplied
 * approved-evidence list for this exact tenant/prospect pair. This checks
 * the citation only: it never scans the draft's free text for facts, so
 * prospect-supplied content or an instruction embedded in the draft cannot
 * manufacture a claim or a supporting evidence record. An evidenceId absent
 * from the approved list is UNKNOWN_EVIDENCE (the model invented or was fed
 * an ID we never issued for this send); an evidenceId that resolves but
 * belongs to a different tenant or prospect is UNSUPPORTED_CLAIM (real
 * evidence that does not license a claim about this recipient).
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
  }

  return Object.freeze(findings);
}
