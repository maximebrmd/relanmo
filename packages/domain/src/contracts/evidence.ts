import type { AccountId, EvidenceId, ProspectId, TenantId } from "./ids";
import type { UtcTimestamp } from "./values";

export const EVIDENCE_PROVENANCE = [
  "PROVIDER_PROFILE",
  "PROVIDER_POST",
  "CUSTOMER_PROFILE",
  "MANUAL_RESEARCH",
] as const;

export type EvidenceProvenance = (typeof EVIDENCE_PROVENANCE)[number];

export type Evidence = Readonly<{
  accountId: AccountId | null;
  capturedAt: UtcTimestamp;
  contentHash: string | null;
  evidenceId: EvidenceId;
  normalizedClaim: string;
  prospectId: ProspectId;
  provenance: EvidenceProvenance;
  sourceId: string;
  sourceUrl: string | null;
  tenantId: TenantId;
}>;
