import type { Evidence } from "../contracts/evidence";
import {
  parseEvidenceId,
  parseProspectId,
  parseTenantId,
} from "../contracts/ids";
import { parseEvidence } from "../contracts/parsers";
import type {
  ContentGuardAttempt,
  ContentGuardCheck,
  ContentGuardConstraints,
  ContentGuardDraft,
} from "./types";

const FIXTURE_TIME = "2026-09-17T10:00:00.000Z";

export const TENANT_DEMO = parseTenantId("tenant_demo");
export const PROSPECT_DEMO = parseProspectId("prospect_demo");
export const EVIDENCE_ID_HIRING_POST = parseEvidenceId(
  "evidence_hiring_post_1"
);
export const EVIDENCE_ID_UNKNOWN = parseEvidenceId(
  "evidence_invented_by_model"
);

export const approvedEvidenceFixture: Evidence = parseEvidence({
  accountId: null,
  capturedAt: FIXTURE_TIME,
  contentHash: null,
  evidenceId: EVIDENCE_ID_HIRING_POST,
  normalizedClaim: "posted about hiring a data engineer in September 2026",
  prospectId: PROSPECT_DEMO,
  provenance: "PROVIDER_POST",
  sourceId: "source_1",
  sourceUrl: "https://www.linkedin.com/posts/example",
  tenantId: TENANT_DEMO,
});

export const defaultAttemptFixture: ContentGuardAttempt = Object.freeze({
  attemptNumber: 1,
  maxAttempts: 3,
});

export const defaultConstraintsFixture: ContentGuardConstraints = Object.freeze(
  {
    forbiddenPhrases: Object.freeze(["garanti à 100%"]),
    knownVariableNames: Object.freeze(["firstName", "offer"]),
    maxLength: 500,
    minLength: 20,
  }
);

export function draftFixture(
  overrides: Partial<ContentGuardDraft> = {}
): ContentGuardDraft {
  return Object.freeze({
    claims: Object.freeze([]),
    step: "DM1",
    text: "Bonjour, ravi de me connecter avec vous et d'échanger sur vos projets actuels.",
    ...overrides,
  });
}

export function contentGuardCheckFixture(
  overrides: Partial<ContentGuardCheck> = {}
): ContentGuardCheck {
  return Object.freeze({
    attempt: defaultAttemptFixture,
    constraints: defaultConstraintsFixture,
    draft: draftFixture(),
    evidence: Object.freeze([approvedEvidenceFixture]),
    prospectId: approvedEvidenceFixture.prospectId,
    tenantId: approvedEvidenceFixture.tenantId,
    ...overrides,
  });
}
