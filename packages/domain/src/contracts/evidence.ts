import type { AccountId, EvidenceId, ProspectId, TenantId } from "./ids";
import type { UtcTimestamp } from "./values";

export const EVIDENCE_PROVENANCE = [
  "PROVIDER_PROFILE",
  "PROVIDER_POST",
  "CUSTOMER_PROFILE",
  "MANUAL_RESEARCH",
] as const;

export type EvidenceProvenance = (typeof EVIDENCE_PROVENANCE)[number];

export const EVIDENCE_ASSERTION_KINDS = [
  "FUNDING",
  "HIRING_ROLE",
  "INBOUND_COMMENT",
  "INBOUND_LIKE",
  "MIGRATION",
  "OFFER",
  "PRODUCT",
  "PROSPECT_POST",
  "RELEASE",
  "ROLE_CHANGE",
  "SPEAKING",
] as const;
export type EvidenceAssertionKind = (typeof EVIDENCE_ASSERTION_KINDS)[number];

export type EvidenceAssertion = Readonly<{
  detail: string | null;
  kind: EvidenceAssertionKind;
  value: string;
}>;

export type Evidence = Readonly<{
  accountId: AccountId | null;
  assertions: readonly EvidenceAssertion[];
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
