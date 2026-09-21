import type {
  CampaignScopedCurrentVersionRepository,
  CampaignScopedProfileRepository,
  CampaignScopedTenantRepository,
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
} from "./contracts";

export type TenancyRepositories = Readonly<{
  currentVersions: CampaignScopedCurrentVersionRepository;
  profiles: CampaignScopedProfileRepository;
  tenants: CampaignScopedTenantRepository;
}>;

export function createTenancyRepositories(): TenancyRepositories {
  return {
    currentVersions: createCurrentVersionRepository(),
    profiles: createProfileRepository(),
    tenants: createTenantRepository(),
  };
}
