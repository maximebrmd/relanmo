import type {
  CampaignScopedCurrentVersionRepository,
  CampaignScopedProfileRepository,
  CampaignScopedTenantRepository,
  TenancyVersionSources,
} from "./contracts";
import {
  createCurrentVersionRepository,
  createProfileRepository,
} from "./profile-repository";
import { createTenantRepository } from "./tenant-repository";

export const tenancyRepositorySurface = "ENABLED" as const;

export {
  createCurrentVersionRepository,
  createProfileRepository,
} from "./profile-repository";
export { createTenantRepository } from "./tenant-repository";
export type {
  CampaignScopedCurrentVersionRepository,
  CampaignScopedProfileRepository,
  CampaignScopedSaveProfileRevisionInput,
  CampaignScopedTenantRepository,
  TenancyVersionSources,
} from "./contracts";

export type TenancyRepositories = Readonly<{
  currentVersions: CampaignScopedCurrentVersionRepository;
  profiles: CampaignScopedProfileRepository;
  tenants: CampaignScopedTenantRepository;
}>;

export function createTenancyRepositories(
  sources: TenancyVersionSources
): TenancyRepositories {
  return {
    currentVersions: createCurrentVersionRepository(sources),
    profiles: createProfileRepository(sources),
    tenants: createTenantRepository(sources),
  };
}
