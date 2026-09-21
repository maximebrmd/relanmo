import type { ProfileVersionId, TenantId, UserId } from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  CurrentVersionSet,
  ProfileVersionRef,
} from "../../contracts/versions";
import type {
  CurrentVersionGuard,
  MembershipId,
  PersistenceResult,
  PersistenceTransaction,
  RevisionMutationResult,
} from "./common";

export const TENANT_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export type TenantRecord = Readonly<{
  createdAt: UtcTimestamp;
  currentVersions: CurrentVersionSet;
  displayName: string;
  status: TenantStatus;
  tenantId: TenantId;
}>;

export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INVITED", "REVOKED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export type MembershipRecord = Readonly<{
  createdAt: UtcTimestamp;
  membershipId: MembershipId;
  role: MembershipRole;
  status: MembershipStatus;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
  userId: UserId;
}>;

export type GetTenantInput = Readonly<{
  tenantId: TenantId;
}>;

export type GetTenantResult = Readonly<{
  tenant: TenantRecord | null;
}>;

export type GetMembershipInput = Readonly<{
  tenantId: TenantId;
  userId: UserId;
}>;

export type GetMembershipResult = Readonly<{
  membership: MembershipRecord | null;
}>;

export type ListMembershipsInput = Readonly<{
  includeRevoked: boolean;
  tenantId: TenantId;
}>;

export type ListMembershipsResult = Readonly<{
  memberships: readonly MembershipRecord[];
}>;

/** Tenant and membership reads are always scoped by the transaction context. */
export interface TenantRepository {
  get: (
    input: GetTenantInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetTenantResult>>;
  getMembership: (
    input: GetMembershipInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetMembershipResult>>;
  listMemberships: (
    input: ListMembershipsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<ListMembershipsResult>>;
}

export type GetCurrentVersionsInput = Readonly<{
  tenantId: TenantId;
}>;

export type GetCurrentVersionsResult = Readonly<{
  observedAt: UtcTimestamp;
  tenantId: TenantId;
  versions: CurrentVersionSet;
}>;

/** Reads the version rows that are shared by mutation and authorization guards. */
export interface CurrentVersionRepository {
  getCurrent: (
    input: GetCurrentVersionsInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetCurrentVersionsResult>>;
}

export type ProfileFacts = Readonly<{
  availability: string | null;
  dayRateCents: number | null;
  exclusions: readonly string[];
  geography: readonly string[];
  offer: string | null;
  preferredFrenchTone: string | null;
  skills: readonly string[];
  targetMarket: string | null;
  writingSamples: readonly string[];
}>;

export type ProfileVersionRecord = Readonly<{
  createdBy: UserId;
  facts: ProfileFacts;
  tenantId: TenantId;
  version: ProfileVersionRef;
}>;

export type GetProfileInput = Readonly<{
  tenantId: TenantId;
}>;

export type GetProfileResult = Readonly<{
  current: CurrentVersionSet;
  profile: ProfileVersionRecord | null;
}>;

export type SaveProfileRevisionInput = Readonly<{
  createdAt: UtcTimestamp;
  createdBy: UserId;
  expectedCurrent: CurrentVersionGuard;
  facts: ProfileFacts;
  profileVersionId: ProfileVersionId;
  tenantId: TenantId;
}>;

export type SaveProfileRevisionValue = Readonly<{
  current: CurrentVersionSet;
  profile: ProfileVersionRecord;
}>;

export type SaveProfileRevisionResult =
  RevisionMutationResult<SaveProfileRevisionValue>;

/** Profile versions are append-only; the current pointer changes only with its guard. */
export interface ProfileRepository {
  get: (
    input: GetProfileInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetProfileResult>>;
  saveRevision: (
    input: SaveProfileRevisionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveProfileRevisionResult>>;
}
