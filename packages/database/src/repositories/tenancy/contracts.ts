import type { CampaignId } from "@relanmo/domain/contracts";
import type {
  CurrentVersionRepository,
  GetProfileInput,
  PersistenceTransaction,
  ProfileRepository,
  SaveProfileRevisionInput,
} from "@relanmo/domain/ports/persistence";

export type CampaignScope = Readonly<{
  campaignId: CampaignId | null;
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
  saveRevision: (
    input: SaveProfileRevisionInput & CampaignScope,
    tx: PersistenceTransaction
  ) => ReturnType<ProfileRepository["saveRevision"]>;
}>;

export type CampaignScopedSaveProfileRevisionInput = SaveProfileRevisionInput &
  CampaignScope;
