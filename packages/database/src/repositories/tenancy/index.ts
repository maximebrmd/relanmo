import type {
  CurrentVersionRepository,
  ProfileRepository,
  TenantRepository,
} from "@relanmo/domain/ports/persistence";

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

export type TenancyRepositories = Readonly<{
  currentVersions: CurrentVersionRepository;
  profiles: ProfileRepository;
  tenants: TenantRepository;
}>;

export function createTenancyRepositories(): TenancyRepositories {
  return {
    currentVersions: createCurrentVersionRepository(),
    profiles: createProfileRepository(),
    tenants: createTenantRepository(),
  };
}
