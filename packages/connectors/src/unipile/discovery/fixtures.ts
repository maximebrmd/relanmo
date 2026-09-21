import { linkedInAccountFixture } from "@relanmo/domain";
import { parseTenantId } from "@relanmo/domain/contracts";

export const unipileDiscoveryBaseUrl = "https://api.unipile.example.test";
export const unipileDiscoveryApiKey = "unipile-test-api-key";

export const unipilePeopleSearchItemFixture = Object.freeze({
  type: "PEOPLE" as const,
  id: "linkedin_profile_demo",
  public_identifier: "camille-exemple",
  public_profile_url: "https://www.linkedin.com/in/camille-exemple",
  profile_url: "https://www.linkedin.com/in/camille-exemple",
  profile_picture_url: null,
  member_urn: "urn:li:member:demo",
  name: "Camille Exemple",
  first_name: "Camille",
  last_name: "Exemple",
  network_distance: "DISTANCE_2" as const,
  location: "Paris",
  industry: null,
  headline: "CTO · recrutement tech",
  current_positions: [
    Object.freeze({
      company: "Entreprise exemple",
      company_id: null,
      description: null,
      role: "CTO",
      location: "Paris",
    }),
  ],
});

export const unipileSparsePeopleSearchItemFixture = Object.freeze({
  type: "PEOPLE" as const,
  id: "linkedin_profile_sparse",
  public_identifier: null,
  public_profile_url: null,
  profile_url: null,
  member_urn: null,
  name: null,
  network_distance: "DISTANCE_3" as const,
  location: null,
  industry: null,
  headline: "",
});

export const unipileCompanySearchItemFixture = Object.freeze({
  type: "COMPANY" as const,
  id: "103848457",
  name: "Entreprise hors périmètre",
  location: "Paris",
  profile_url: "https://www.linkedin.com/company/exemple",
  industry: "Software Development",
  summary: null,
});

export const unipilePeopleSearchPageFixture = Object.freeze({
  object: "LinkedinSearch" as const,
  items: [unipilePeopleSearchItemFixture],
  paging: Object.freeze({
    start: 0,
    page_count: 1,
    total_count: 2,
  }),
  cursor: "cursor_demo_2",
});

export const unipilePeopleSearchEmptyPageFixture = Object.freeze({
  object: "LinkedinSearch" as const,
  items: [],
  paging: Object.freeze({
    start: 0,
    page_count: 0,
    total_count: 0,
  }),
  cursor: null,
});

export const unipilePeopleSearchLastPageFixture = Object.freeze({
  object: "LinkedinSearch" as const,
  items: [unipileSparsePeopleSearchItemFixture],
  paging: Object.freeze({
    start: 1,
    page_count: 1,
    total_count: 2,
  }),
});

export const unipilePeopleSearchMixedPageFixture = Object.freeze({
  object: "LinkedinSearch" as const,
  items: [unipileCompanySearchItemFixture, unipilePeopleSearchItemFixture],
  paging: Object.freeze({
    start: 0,
    page_count: 2,
    total_count: 2,
  }),
  cursor: null,
});

export const unipileLinkedInProfileFixture = Object.freeze({
  object: "UserProfile" as const,
  provider: "LINKEDIN" as const,
  provider_id: "linkedin_profile_demo",
  public_identifier: "camille-exemple",
  public_profile_url: "https://www.linkedin.com/in/camille-exemple",
  first_name: "Camille",
  last_name: "Exemple",
  headline: "CTO · recrutement tech",
  location: "Paris",
  websites: [],
  work_experience: [
    Object.freeze({
      position: "CTO",
      company: "Entreprise exemple",
      current: true,
      start: "2020-01",
      end: null,
    }),
  ],
});

export const unipileSparseLinkedInProfileFixture = Object.freeze({
  object: "UserProfile" as const,
  provider: "LINKEDIN" as const,
  provider_id: "linkedin_profile_sparse",
  public_identifier: null,
  first_name: null,
  last_name: null,
  headline: "",
  websites: [],
});

export const unipileRateLimitErrorBody = Object.freeze({
  status: 429,
  title: "Too Many Requests",
  detail: "LinkedIn rate limit reached",
});

export const unipileSalesNavigatorRequiredErrorBody = Object.freeze({
  status: 403,
  title: "Forbidden",
  detail: "Sales Navigator is required for this LinkedIn search",
});

export const otherTenantId = parseTenantId("tenant_other");

export const otherTenantAccountRef = Object.freeze({
  ...linkedInAccountFixture,
  tenantId: otherTenantId,
});

export {
  linkedInAccountFixture,
  linkedInReadProfileInputFixture,
  linkedInSearchCandidatesInputFixture,
  providerOperationContextFixture,
} from "@relanmo/domain";
