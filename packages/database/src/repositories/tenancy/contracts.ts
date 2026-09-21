import type {
  CampaignId,
  ModelVersion,
  ProfileVersionRef,
  PromptVersionRef,
} from "@relanmo/domain/contracts";
import type {
  CurrentVersionRepository,
  GetProfileInput,
  PersistenceResult,
  PersistenceTransaction,
  ProfileRepository,
  ProfileVersionRecord,
  SaveProfileRevisionInput,
  TenantRepository,
} from "@relanmo/domain/ports/persistence";

export type CampaignScope = Readonly<{
  campaignId: CampaignId;
}>;

export type TenancyVersionSources = Readonly<{
  defaultPromptVersion: () => PromptVersionRef;
  writingModelVersion: () => ModelVersion;
}>;

export type CampaignScopedCurrentVersionRepository = Readonly<{
  getCurrent: (
    input: Parameters<CurrentVersionRepository["getCurrent"]>[0] &
      CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<CurrentVersionRepository["getCurrent"]>;
}>;

export type OnboardingProfileState = Readonly<{
  profile: ProfileVersionRecord | null;
  version: ProfileVersionRef | null;
}>;

export type SaveOnboardingProfileRevisionInput = Omit<
  SaveProfileRevisionInput,
  "expectedCurrent"
> &
  Readonly<{
    expectedProfile: ProfileVersionRef | null;
  }>;

export type SaveOnboardingProfileRevisionResult =
  | Readonly<{
      outcome: "UPDATED";
      value: OnboardingProfileState;
    }>
  | Readonly<{
      actual: ProfileVersionRef | null;
      expected: ProfileVersionRef | null;
      outcome: "REVISION_CONFLICT";
    }>;

export type CampaignScopedProfileRepository = Readonly<{
  get: (
    input: GetProfileInput & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["get"]>;
  getForOnboarding: (
    input: GetProfileInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<OnboardingProfileState>>;
  saveRevision: (
    input: SaveProfileRevisionInput & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["saveRevision"]>;
  saveForOnboarding: (
    input: SaveOnboardingProfileRevisionInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<SaveOnboardingProfileRevisionResult>>;
}>;

export type CampaignScopedTenantRepository = Readonly<{
  get: (
    input: Parameters<TenantRepository["get"]>[0] & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<TenantRepository["get"]>;
  getMembership: TenantRepository["getMembership"];
  listMemberships: TenantRepository["listMemberships"];
}>;

export type CampaignScopedSaveProfileRevisionInput = SaveProfileRevisionInput &
  CampaignScope;
