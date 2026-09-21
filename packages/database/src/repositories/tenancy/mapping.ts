/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This module is the boundary that maps untyped database rows onto C3 tenancy records. */

import {
  parseCampaignVersionId,
  parseExplicitStyleVersionId,
  parseInferredStyleVersionId,
  isMember,
  parseProfileVersionId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  CampaignVersionRef,
  CurrentVersionSet,
  ExplicitStyleVersionRef,
  InferredStyleVersionRef,
  ProfileVersionRef,
  UtcTimestamp,
  VersionRef,
} from "@relanmo/domain/contracts";
import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  TENANT_STATUSES,
} from "@relanmo/domain/ports/persistence";
import type {
  MembershipId,
  MembershipRecord,
  PersistenceFailure,
  ProfileFacts,
  ProfileVersionRecord,
  TenantRecord,
} from "@relanmo/domain/ports/persistence";
import type { InferSelectModel } from "drizzle-orm";

import type { campaignVersions } from "../../schema/campaigns";
import type { styleProfileVersions } from "../../schema/styles";
import type {
  freelancerProfiles,
  memberships,
  tenants,
} from "../../schema/tenancy";

export type TenantRow = InferSelectModel<typeof tenants>;
export type MembershipRow = InferSelectModel<typeof memberships>;
export type ProfileRow = InferSelectModel<typeof freelancerProfiles>;
export type CampaignVersionRow = InferSelectModel<typeof campaignVersions>;
export type StyleVersionRow = InferSelectModel<typeof styleProfileVersions>;

export class TenancyMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenancyMappingError";
  }
}

export function mappingFailure(detail: string): PersistenceFailure {
  return {
    error: { code: "INTEGRITY", detail, retryable: false },
    ok: false,
  };
}

export function catchMappingError(error: unknown): PersistenceFailure {
  if (error instanceof TenancyMappingError) {
    return mappingFailure(error.message);
  }
  throw error;
}

export function emptyCurrentVersions(): CurrentVersionSet {
  const current = {
    acceptedInferredStyle: null,
    campaign: null,
    defaultPrompt: null,
    explicitStyle: null,
    model: null,
    profile: null,
    promptOverride: null,
  };
  return current;
}

export function currentVersionsWithProfile(
  current: CurrentVersionSet,
  profile: ProfileVersionRef | null
): CurrentVersionSet {
  return { ...current, profile };
}

export function versionRefEqual(
  left: VersionRef | null,
  right: VersionRef | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.revision === right.revision &&
    left.createdAt === right.createdAt
  );
}

export function currentVersionsEqual(
  left: CurrentVersionSet,
  right: CurrentVersionSet
): boolean {
  return (
    versionRefEqual(left.profile, right.profile) &&
    versionRefEqual(left.campaign, right.campaign) &&
    versionRefEqual(left.explicitStyle, right.explicitStyle) &&
    versionRefEqual(left.acceptedInferredStyle, right.acceptedInferredStyle) &&
    versionRefEqual(left.defaultPrompt, right.defaultPrompt) &&
    left.model === right.model
  );
}

export function utcFromColumn(value: Date): UtcTimestamp {
  return parseUtcTimestamp(value.toISOString());
}

export function dateFromUtc(value: UtcTimestamp): Date {
  return new Date(value);
}

function requireString(value: string, path: string): string {
  if (value.length === 0) {
    throw new TenancyMappingError(`${path} must be a non-empty string`);
  }
  return value;
}

function nullableInteger(value: number | null, path: string): number | null {
  if (value === null) {
    return null;
  }
  if (Number.isInteger(value)) {
    return value;
  }
  throw new TenancyMappingError(`${path} must be an integer or null`);
}

function stringList(value: readonly string[], path: string): readonly string[] {
  if (value.some((item) => item.length === 0)) {
    throw new TenancyMappingError(`${path} must not contain empty strings`);
  }
  return value;
}

function parseMembershipId(value: string): MembershipId {
  // SAFETY: membership ids are opaque persistence record ids from our rows.
  return requireString(value, "membershipId") as MembershipId;
}

export function mapTenantRecord(
  row: TenantRow,
  currentVersions: CurrentVersionSet
): TenantRecord {
  const status = requireString(row.status, "tenant.status");
  if (!isMember(status, TENANT_STATUSES)) {
    throw new TenancyMappingError("tenant.status is not a known tenant status");
  }
  return {
    createdAt: utcFromColumn(row.createdAt),
    currentVersions,
    displayName: requireString(row.displayName, "tenant.displayName"),
    status,
    tenantId: parseTenantId(row.id),
  };
}

export function mapMembershipRecord(row: MembershipRow): MembershipRecord {
  const role = requireString(row.role, "membership.role");
  const status = requireString(row.status, "membership.status");
  if (!isMember(role, MEMBERSHIP_ROLES)) {
    throw new TenancyMappingError("membership.role is not a known role");
  }
  if (!isMember(status, MEMBERSHIP_STATUSES)) {
    throw new TenancyMappingError("membership.status is not a known status");
  }
  return {
    createdAt: utcFromColumn(row.createdAt),
    membershipId: parseMembershipId(row.id),
    role,
    status,
    tenantId: parseTenantId(row.tenantId),
    updatedAt: utcFromColumn(row.updatedAt),
    userId: parseUserId(row.userId),
  };
}

export function mapProfileFacts(row: ProfileRow): ProfileFacts {
  return {
    availability: row.availability,
    dayRateCents: nullableInteger(row.dayRateCents, "profile.dayRateCents"),
    exclusions: stringList(row.exclusions, "profile.exclusions"),
    geography: stringList(row.geography, "profile.geography"),
    offer: row.offer,
    preferredFrenchTone: row.preferredFrenchTone,
    skills: stringList(row.skills, "profile.skills"),
    targetMarket: row.targetMarket,
    writingSamples: stringList(row.writingSamples, "profile.writingSamples"),
  };
}

export function mapProfileVersion(row: ProfileRow): ProfileVersionRecord {
  const createdAt = utcFromColumn(row.createdAt);
  return {
    createdBy: parseUserId(row.createdBy),
    facts: mapProfileFacts(row),
    tenantId: parseTenantId(row.tenantId),
    version: {
      createdAt,
      id: parseProfileVersionId(row.id),
      kind: "PROFILE",
      revision: row.revision,
    },
  };
}

export function mapCampaignVersionRef(
  row: CampaignVersionRow
): CampaignVersionRef {
  return {
    createdAt: utcFromColumn(row.createdAt),
    id: parseCampaignVersionId(row.id),
    kind: "CAMPAIGN",
    revision: row.revision,
  };
}

export function mapExplicitStyleVersionRef(
  row: StyleVersionRow
): ExplicitStyleVersionRef {
  if (row.kind !== "STYLE_EXPLICIT") {
    throw new TenancyMappingError("explicit style pointer has the wrong kind");
  }
  return {
    createdAt: utcFromColumn(row.createdAt),
    id: parseExplicitStyleVersionId(row.id),
    kind: "STYLE_EXPLICIT",
    revision: row.revision,
  };
}

export function mapInferredStyleVersionRef(
  row: StyleVersionRow
): InferredStyleVersionRef {
  if (row.kind !== "STYLE_INFERRED") {
    throw new TenancyMappingError(
      "accepted inferred style pointer has the wrong kind"
    );
  }
  return {
    createdAt: utcFromColumn(row.createdAt),
    id: parseInferredStyleVersionId(row.id),
    kind: "STYLE_INFERRED",
    revision: row.revision,
  };
}
