import {
  parseProfileVersionId,
  parseTenantId,
  parseUserId,
} from "../../contracts/ids";
import { parseUtcTimestamp } from "../../contracts/values";
import type { CurrentVersionSet } from "../../contracts/versions";
import type { CurrentVersionGuard } from "./common";
import type {
  GetProfileResult,
  ProfileFacts,
  ProfileVersionRecord,
  SaveProfileRevisionInput,
} from "./tenancy";

const timestamp = parseUtcTimestamp("2026-09-17T10:00:00.000Z");
const tenantId = parseTenantId("tenant_demo");
const userId = parseUserId("user_demo");

export const emptyCurrentVersionSetFixture: CurrentVersionSet = Object.freeze({
  acceptedInferredStyle: null,
  campaign: null,
  defaultPrompt: null,
  explicitStyle: null,
  model: null,
  profile: null,
  promptOverride: null,
});

export const profileFactsFixture = Object.freeze({
  availability: "Disponible 3 jours par semaine",
  dayRateCents: 75_000,
  exclusions: Object.freeze(["Pas de missions full-time"]),
  geography: Object.freeze(["France", "télétravail UE"]),
  offer: "J’aide les équipes SaaS à structurer leur prospection B2B.",
  preferredFrenchTone: "DIRECT",
  skills: Object.freeze(["Prospection B2B", "Stratégie commerciale"]),
  targetMarket: "Éditeurs SaaS B2B",
  writingSamples: Object.freeze([
    "Bonjour, je vous contacte au sujet de votre recrutement.",
  ]),
}) satisfies ProfileFacts;

export const profileVersionRecordFixture: ProfileVersionRecord = Object.freeze({
  createdBy: userId,
  facts: profileFactsFixture,
  tenantId,
  version: Object.freeze({
    createdAt: timestamp,
    id: parseProfileVersionId("version_profile_1"),
    kind: "PROFILE",
    revision: 4,
  }),
});

export const saveProfileRevisionInputFixture: SaveProfileRevisionInput =
  Object.freeze({
    createdAt: timestamp,
    createdBy: userId,
    expectedCurrent: Object.freeze({
      expected: emptyCurrentVersionSetFixture,
    }) satisfies CurrentVersionGuard,
    facts: profileFactsFixture,
    profileVersionId: parseProfileVersionId("version_profile_2"),
    tenantId,
  });

export const getProfileResultFixture: GetProfileResult = Object.freeze({
  current: Object.freeze({
    ...emptyCurrentVersionSetFixture,
    profile: profileVersionRecordFixture.version,
  }),
  profile: profileVersionRecordFixture,
});
