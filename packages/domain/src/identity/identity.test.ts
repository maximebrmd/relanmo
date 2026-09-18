import { describe, expect, it } from "vitest";

import {
  parseAccountId,
  parseProspectId,
  parseTenantId,
} from "../contracts/ids";
import {
  parseAccountProspectOwnership,
  parseSuppressionEntry,
} from "../contracts/parsers";
import { resolveProspectIdentity } from "./dedup";
import { canonicalizeLinkedInPublicIdentifier } from "./linkedin-identifier";
import { matchProspectIdentities } from "./match";
import { buildIdentitySignals } from "./signals";
import { evaluateCampaignEntry, resolveCampaignEntry } from "./suppression";

const TENANT_A = parseTenantId("tenant_alpha");
const TENANT_B = parseTenantId("tenant_beta");
const ACCOUNT_A = parseAccountId("account_alpha");
const ACCOUNT_B = parseAccountId("account_beta");
const TIMESTAMP = "2026-09-17T10:00:00.000Z";

function signalsFor(
  overrides: Partial<Parameters<typeof buildIdentitySignals>[0]> = {}
) {
  return buildIdentitySignals({
    accountId: ACCOUNT_A,
    legacyProviderMemberIds: [],
    profileUrl: null,
    providerMemberId: null,
    tenantId: TENANT_A,
    ...overrides,
  });
}

describe("canonicalizeLinkedInPublicIdentifier", () => {
  it("normalizes supported public profile URL variants to the same identifier", () => {
    const variants = [
      "https://www.linkedin.com/in/John-Doe-12345/",
      "http://linkedin.com/in/john-doe-12345",
      "https://m.linkedin.com/in/JOHN-DOE-12345?trk=public_profile",
      "linkedin.com/in/john-doe-12345",
      "john-doe-12345",
    ];

    for (const variant of variants) {
      const result = canonicalizeLinkedInPublicIdentifier(variant);
      expect(result).toEqual({
        identifier: "john-doe-12345",
        outcome: "PUBLIC_PROFILE",
      });
    }
  });

  it("flags Sales Navigator/Recruiter/company URLs as unsupported rather than guessing", () => {
    const unsupported = [
      "https://www.linkedin.com/sales/lead/ACwAAB1234,NAME_SEARCH",
      "https://www.linkedin.com/talent/profile/12345",
      "https://www.linkedin.com/company/acme",
      "https://example.com/in/john-doe",
    ];

    for (const url of unsupported) {
      const result = canonicalizeLinkedInPublicIdentifier(url);
      expect(
        result.outcome === "UNSUPPORTED" || result.outcome === "INVALID"
      ).toBe(true);
    }
  });

  it("treats missing input as an explicit unknown, never a guess", () => {
    expect(canonicalizeLinkedInPublicIdentifier(null).outcome).toBe("INVALID");
  });
});

describe("matchProspectIdentities", () => {
  it("matches URL variants of one profile without joining different people", () => {
    const fromWww = signalsFor({
      profileUrl: "https://www.linkedin.com/in/John-Doe-12345/",
    });
    const fromMobile = signalsFor({
      profileUrl: "https://m.linkedin.com/in/john-doe-12345",
    });
    const differentPerson = signalsFor({
      profileUrl: "https://www.linkedin.com/in/jane-smith-99999",
    });

    expect(matchProspectIdentities(fromWww, fromMobile)).toEqual({
      outcome: "SAME",
      reason: "PUBLIC_IDENTIFIER_MATCH",
    });
    expect(matchProspectIdentities(fromWww, differentPerson)).toEqual({
      outcome: "DIFFERENT",
      reason: "NO_SHARED_IDENTIFIER",
    });
  });

  it("never infers identity from a name alone: distinct people with no shared identifier stay distinct", () => {
    const a = signalsFor({ providerMemberId: "provider_member_1" });
    const b = signalsFor({ providerMemberId: "provider_member_2" });

    expect(matchProspectIdentities(a, b)).toEqual({
      outcome: "DIFFERENT",
      reason: "NO_SHARED_IDENTIFIER",
    });
  });

  it("keeps cross-tenant records separate even with the same public identifier", () => {
    const inTenantA = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      tenantId: TENANT_A,
    });
    const inTenantB = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      tenantId: TENANT_B,
    });

    expect(matchProspectIdentities(inTenantA, inTenantB)).toEqual({
      outcome: "DIFFERENT",
      reason: "CROSS_TENANT",
    });
  });

  it("keeps cross-account records separate within the same tenant", () => {
    const inAccountA = signalsFor({
      accountId: ACCOUNT_A,
      profileUrl: "https://www.linkedin.com/in/shared-slug",
    });
    const inAccountB = signalsFor({
      accountId: ACCOUNT_B,
      profileUrl: "https://www.linkedin.com/in/shared-slug",
    });

    expect(matchProspectIdentities(inAccountA, inAccountB)).toEqual({
      outcome: "DIFFERENT",
      reason: "CROSS_ACCOUNT",
    });
  });

  it("flags an ambiguous alias instead of merging when a shared URL disagrees on provider member ID", () => {
    const a = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      providerMemberId: "provider_member_1",
    });
    const b = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      providerMemberId: "provider_member_2",
    });

    expect(matchProspectIdentities(a, b)).toEqual({
      outcome: "AMBIGUOUS",
      reason: "PROVIDER_MEMBER_ID_CONFLICT",
    });
  });

  it("matches through a legacy provider member ID inherited across a migration", () => {
    const migrated = signalsFor({ providerMemberId: "provider_member_new" });
    const legacyRecord = signalsFor({
      legacyProviderMemberIds: ["provider_member_new"],
      providerMemberId: "provider_member_old",
    });

    expect(matchProspectIdentities(migrated, legacyRecord)).toEqual({
      outcome: "SAME",
      reason: "LEGACY_ID_MATCH",
    });
  });
});

describe("resolveProspectIdentity", () => {
  it("returns NEW when no known prospect shares an identifier", () => {
    const candidate = signalsFor({ providerMemberId: "provider_member_1" });
    const result = resolveProspectIdentity(candidate, [
      {
        ...signalsFor({ providerMemberId: "provider_member_2" }),
        prospectId: parseProspectId("prospect_1"),
      },
    ]);

    expect(result).toEqual({ outcome: "NEW" });
  });

  it("returns an explicit unresolved collision when a candidate matches two distinct prospects", () => {
    const sharedProviderId = "provider_member_shared";
    const candidate = signalsFor({
      legacyProviderMemberIds: [sharedProviderId],
    });
    const known = [
      {
        ...signalsFor({ providerMemberId: sharedProviderId }),
        prospectId: parseProspectId("prospect_1"),
      },
      {
        ...signalsFor({
          profileUrl: "https://www.linkedin.com/in/distinct-slug",
          legacyProviderMemberIds: [sharedProviderId],
        }),
        prospectId: parseProspectId("prospect_2"),
      },
    ];

    const result = resolveProspectIdentity(candidate, known);
    expect(result.outcome).toBe("UNRESOLVED_COLLISION");
    if (result.outcome === "UNRESOLVED_COLLISION") {
      expect(result.candidates).toEqual(["prospect_1", "prospect_2"]);
    }
  });

  it("returns an explicit unresolved collision for an ambiguous alias rather than guessing", () => {
    const candidate = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      providerMemberId: "provider_member_candidate",
    });
    const known = [
      {
        ...signalsFor({
          profileUrl: "https://www.linkedin.com/in/shared-slug",
          providerMemberId: "provider_member_existing",
        }),
        prospectId: parseProspectId("prospect_1"),
      },
    ];

    expect(resolveProspectIdentity(candidate, known).outcome).toBe(
      "UNRESOLVED_COLLISION"
    );
  });
});

describe("evaluateCampaignEntry / resolveCampaignEntry", () => {
  const ownershipRecord = parseAccountProspectOwnership({
    accountId: ACCOUNT_A,
    ownership: {
      kind: "HUMAN_OWNED",
      ownerUserId: null,
      reason: "INCOMING_MESSAGE",
      recordedAt: TIMESTAMP,
    },
    prospectId: "prospect_owned",
    tenantId: TENANT_A,
  });

  const suppressionRecord = parseSuppressionEntry({
    accountId: ACCOUNT_A,
    prospectId: "prospect_suppressed",
    reason: "DO_NOT_CONTACT",
    recordedAt: TIMESTAMP,
    tenantId: TENANT_A,
  });

  it("is eligible when there is no ownership or suppression record", () => {
    expect(
      evaluateCampaignEntry({ ownership: null, suppression: null })
    ).toEqual({ outcome: "ELIGIBLE" });
  });

  it("excludes a suppressed prospect from a new campaign", () => {
    const result = evaluateCampaignEntry({
      ownership: null,
      suppression: suppressionRecord,
    });
    expect(result).toEqual({ outcome: "EXCLUDED", reasons: ["SUPPRESSED"] });
  });

  it("excludes a historically human-owned prospect from a new campaign", () => {
    const result = evaluateCampaignEntry({
      ownership: ownershipRecord,
      suppression: null,
    });
    expect(result).toEqual({
      outcome: "EXCLUDED",
      reasons: ["HISTORICALLY_HUMAN_OWNED"],
    });
  });

  it("reports both reasons when a prospect is both suppressed and human-owned", () => {
    const result = evaluateCampaignEntry({
      ownership: ownershipRecord,
      suppression: suppressionRecord,
    });
    expect(result).toEqual({
      outcome: "EXCLUDED",
      reasons: ["SUPPRESSED", "HISTORICALLY_HUMAN_OWNED"],
    });
  });

  it("a bot-eligible ownership record does not exclude a prospect", () => {
    const botEligible = parseAccountProspectOwnership({
      accountId: ACCOUNT_A,
      ownership: {
        kind: "BOT_ELIGIBLE",
        ownerUserId: null,
        reason: "INITIAL_ACTIVATION",
        recordedAt: TIMESTAMP,
      },
      prospectId: "prospect_bot",
      tenantId: TENANT_A,
    });

    expect(
      evaluateCampaignEntry({ ownership: botEligible, suppression: null })
    ).toEqual({ outcome: "ELIGIBLE" });
  });

  it("resolveCampaignEntry excludes a re-imported prospect that was previously suppressed", () => {
    const candidate = signalsFor({ providerMemberId: "provider_member_1" });
    const known = [
      {
        ...signalsFor({ providerMemberId: "provider_member_1" }),
        ownership: null,
        prospectId: parseProspectId("prospect_suppressed"),
        suppression: suppressionRecord,
      },
    ];

    const result = resolveCampaignEntry(candidate, known);
    expect(result).toEqual({
      outcome: "EXCLUDED",
      prospectId: "prospect_suppressed",
      reasons: ["SUPPRESSED"],
    });
  });

  it("resolveCampaignEntry allows a genuinely new prospect", () => {
    const candidate = signalsFor({ providerMemberId: "provider_member_new" });
    const known = [
      {
        ...signalsFor({ providerMemberId: "provider_member_other" }),
        ownership: null,
        prospectId: parseProspectId("prospect_other"),
        suppression: null,
      },
    ];

    expect(resolveCampaignEntry(candidate, known)).toEqual({ outcome: "NEW" });
  });

  it("resolveCampaignEntry surfaces an unresolved collision instead of choosing a side", () => {
    const candidate = signalsFor({
      profileUrl: "https://www.linkedin.com/in/shared-slug",
      providerMemberId: "provider_member_candidate",
    });
    const known = [
      {
        ...signalsFor({
          profileUrl: "https://www.linkedin.com/in/shared-slug",
          providerMemberId: "provider_member_existing",
        }),
        ownership: null,
        prospectId: parseProspectId("prospect_existing"),
        suppression: null,
      },
    ];

    const result = resolveCampaignEntry(candidate, known);
    expect(result.outcome).toBe("UNRESOLVED_COLLISION");
  });
});
