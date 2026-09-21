import type {
  CampaignId,
  ModelVersion,
  PromptVersionRef,
} from "@relanmo/domain/contracts";
import type {
  CurrentVersionRepository,
  GetProfileInput,
  PersistenceTransaction,
  ProfileRepository,
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

export type CampaignScopedProfileRepository = Readonly<{
  get: (
    input: GetProfileInput & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["get"]>;
  initialize: (
    input: SaveProfileRevisionInput,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["saveRevision"]>;
  saveRevision: (
    input: SaveProfileRevisionInput & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["saveRevision"]>;
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
