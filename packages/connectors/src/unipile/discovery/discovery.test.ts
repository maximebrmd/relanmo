import type {
  LinkedInDiscoveryPort,
  ProviderReadResult,
} from "@relanmo/domain";
import { parseUtcTimestamp } from "@relanmo/domain/contracts";
import { UnsuccessfulRequestError } from "unipile-node-sdk";
import { describe, expect, it } from "vitest";

import type { UnipileAccountDirectory } from "../accounts/bindings";
import {
  linkedInAccountFixture,
  linkedInReadProfileInputFixture,
  linkedInSearchCandidatesInputFixture,
  otherTenantAccountRef,
  providerOperationContextFixture,
  unipileDiscoveryApiKey,
  unipileDiscoveryBaseUrl,
  unipileLinkedInProfileFixture,
  unipilePeopleSearchEmptyPageFixture,
  unipilePeopleSearchLastPageFixture,
  unipilePeopleSearchMixedPageFixture,
  unipilePeopleSearchPageFixture,
  unipileRateLimitErrorBody,
  unipileSalesNavigatorRequiredErrorBody,
  unipileSparseLinkedInProfileFixture,
} from "./fixtures";
import { createUnipileLinkedInDiscoveryPort } from "./index";
import type {
  UnipileDiscoveryConfig,
  UnipileDiscoveryGateway,
  UnipilePeopleSearchRequest,
} from "./index";
import { parseLinkedInProfile, parsePeopleSearchPage } from "./parse";
import type {
  UnipileObservedPersonFacts,
  UnipilePeopleSearchPage,
} from "./parse";

function readValue<Value>(result: ProviderReadResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

type RecordingGateway = UnipileDiscoveryGateway & {
  profileCalls: Readonly<{ accountId: string; identifier: string }>[];
  searchCalls: UnipilePeopleSearchRequest[];
};

const authorizedDirectory: UnipileAccountDirectory = {
  isAuthorized(providerAccountId, tenantId) {
    return (
      providerAccountId === linkedInAccountFixture.providerAccountId &&
      tenantId === linkedInAccountFixture.tenantId
    );
  },
};

type SearchPageFixture =
  | typeof unipilePeopleSearchEmptyPageFixture
  | typeof unipilePeopleSearchLastPageFixture
  | typeof unipilePeopleSearchMixedPageFixture
  | typeof unipilePeopleSearchPageFixture;

type ProfileFixture =
  | typeof unipileLinkedInProfileFixture
  | typeof unipileSparseLinkedInProfileFixture;

function parsedSearchPage(fixture: SearchPageFixture): UnipilePeopleSearchPage {
  const page = parsePeopleSearchPage(fixture);
  if (page === null) {
    throw new Error("fixture must parse as a LinkedIn search page");
  }
  return page;
}

function parsedProfile(fixture: ProfileFixture): UnipileObservedPersonFacts {
  const profile = parseLinkedInProfile(fixture);
  if (profile === null) {
    throw new Error("fixture must parse as a LinkedIn profile");
  }
  return profile;
}

function createRecordingGateway(options?: {
  profile?: UnipileObservedPersonFacts;
  search?: UnipilePeopleSearchPage;
}): RecordingGateway {
  const profileCalls: RecordingGateway["profileCalls"] = [];
  const searchCalls: UnipilePeopleSearchRequest[] = [];
  const profile =
    options?.profile ?? parsedProfile(unipileLinkedInProfileFixture);
  const search =
    options?.search ?? parsedSearchPage(unipilePeopleSearchPageFixture);
  return {
    profileCalls,
    searchCalls,
    getProfile(input) {
      profileCalls.push(input);
      return Promise.resolve(profile);
    },
    searchPeople(input) {
      searchCalls.push(input);
      return Promise.resolve(search);
    },
  };
}

function createPort(options?: {
  directory?: UnipileAccountDirectory;
  now?: string;
  profile?: UnipileObservedPersonFacts;
  search?: UnipilePeopleSearchPage;
}) {
  const gateway = createRecordingGateway({
    profile: options?.profile,
    search: options?.search,
  });
  const port: LinkedInDiscoveryPort = createUnipileLinkedInDiscoveryPort({
    apiKey: unipileDiscoveryApiKey,
    baseUrl: unipileDiscoveryBaseUrl,
    clock: () => new Date(options?.now ?? "2026-09-17T10:00:00.000Z"),
    directory: options?.directory ?? authorizedDirectory,
    gateway,
  });
  return { gateway, port };
}

function createPortWithGateway(
  gateway: UnipileDiscoveryGateway,
  directory: UnipileAccountDirectory = authorizedDirectory,
  options: Pick<UnipileDiscoveryConfig, "clock" | "sleep"> = {}
) {
  return createUnipileLinkedInDiscoveryPort({
    apiKey: unipileDiscoveryApiKey,
    baseUrl: unipileDiscoveryBaseUrl,
    clock:
      options.clock ?? (() => new Date("2026-09-17T10:00:00.000Z")),
    directory,
    gateway,
    ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
  });
}

describe("Unipile LinkedIn discovery adapter", () => {
  it("searches classic people pages without Sales Navigator or Recruiter", async () => {
    const { gateway, port } = createPort();
    const page = readValue(
      await port.searchCandidates(linkedInSearchCandidatesInputFixture)
    );

    expect(page.candidates).toEqual([
      {
        currentCompany: "Entreprise exemple",
        currentRole: "CTO",
        displayName: "Camille Exemple",
        headline: "CTO · recrutement tech",
        location: "Paris",
        missingFields: [],
        observedAt: "2026-09-17T10:00:00.000Z",
        profileUrl: "https://www.linkedin.com/in/camille-exemple",
        providerProfileId: "linkedin_profile_demo",
        provenance: "SEARCH_RESULT",
      },
    ]);
    expect(page.exhausted).toBe(false);
    expect(page.nextCursor).toBe("cursor_demo_2");
    expect(gateway.searchCalls).toHaveLength(1);
    expect(gateway.searchCalls[0]).toMatchObject({
      accountId: linkedInAccountFixture.providerAccountId,
      api: "classic",
      category: "people",
      limit: 10,
    });
    expect(gateway.searchCalls[0]?.api).not.toBe("sales_navigator");
    expect(gateway.searchCalls[0]?.api).not.toBe("recruiter");
    expect(gateway.searchCalls[0]).not.toHaveProperty("linkedin_api");
  });

  it("keeps only people hits from a mixed search page", async () => {
    const { port } = createPort({
      search: parsedSearchPage(unipilePeopleSearchMixedPageFixture),
    });
    const page = readValue(
      await port.searchCandidates(linkedInSearchCandidatesInputFixture)
    );

    expect(page.candidates).toHaveLength(1);
    expect(page.candidates[0]?.providerProfileId).toBe("linkedin_profile_demo");
    expect(page.exhausted).toBe(true);
  });

  it("returns an empty exhausted page without inventing candidates", async () => {
    const { port } = createPort({
      search: parsedSearchPage(unipilePeopleSearchEmptyPageFixture),
    });
    const page = readValue(
      await port.searchCandidates(linkedInSearchCandidatesInputFixture)
    );

    expect(page.candidates).toEqual([]);
    expect(page.exhausted).toBe(true);
    expect(page.nextCursor).toBeNull();
  });

  it("continues from a cursor and records missing search fields", async () => {
    const { gateway, port } = createPort({
      search: parsedSearchPage(unipilePeopleSearchLastPageFixture),
    });
    const page = readValue(
      await port.searchCandidates({
        ...linkedInSearchCandidatesInputFixture,
        cursor: "cursor_demo_2",
      })
    );

    expect(gateway.searchCalls[0]?.cursor).toBe("cursor_demo_2");
    expect(page.exhausted).toBe(true);
    expect(page.nextCursor).toBeNull();
    expect(page.candidates).toHaveLength(1);
    expect(page.candidates[0]?.providerProfileId).toBe(
      "linkedin_profile_sparse"
    );
    expect(page.candidates[0]?.displayName).toBeNull();
    expect(page.candidates[0]?.headline).toBeNull();
    expect(page.candidates[0]?.location).toBeNull();
    expect(page.candidates[0]?.profileUrl).toBeNull();
    expect(page.candidates[0]?.currentCompany).toBeNull();
    expect(page.candidates[0]?.currentRole).toBeNull();
    expect(page.candidates[0]?.missingFields).toEqual([
      "CURRENT_COMPANY",
      "CURRENT_ROLE",
      "DISPLAY_NAME",
      "HEADLINE",
      "LOCATION",
      "PROFILE_URL",
    ]);
  });

  it("reads a profile through the official SDK without paid LinkedIn APIs", async () => {
    const { gateway, port } = createPort();
    const profile = readValue(
      await port.readProfile(linkedInReadProfileInputFixture)
    );

    expect(profile).toEqual({
      currentCompany: "Entreprise exemple",
      currentRole: "CTO",
      displayName: "Camille Exemple",
      headline: "CTO · recrutement tech",
      location: "Paris",
      missingFields: [],
      observedAt: "2026-09-17T10:00:00.000Z",
      profileUrl: "https://www.linkedin.com/in/camille-exemple",
      providerProfileId: "linkedin_profile_demo",
      provenance: "PROFILE_READ",
    });
    expect(gateway.profileCalls).toEqual([
      {
        accountId: linkedInAccountFixture.providerAccountId,
        identifier: "linkedin_profile_demo",
      },
    ]);
  });

  it("keeps absent profile facts missing instead of inventing them", async () => {
    const { port } = createPort({
      profile: parsedProfile(unipileSparseLinkedInProfileFixture),
    });
    const profile = readValue(
      await port.readProfile({
        ...linkedInReadProfileInputFixture,
        providerProfileId: "linkedin_profile_sparse",
      })
    );

    expect(profile.displayName).toBeNull();
    expect(profile.headline).toBeNull();
    expect(profile.location).toBeNull();
    expect(profile.profileUrl).toBeNull();
    expect(profile.currentCompany).toBeNull();
    expect(profile.currentRole).toBeNull();
    expect(profile.missingFields).toEqual([
      "CURRENT_COMPANY",
      "CURRENT_ROLE",
      "DISPLAY_NAME",
      "HEADLINE",
      "LOCATION",
      "PROFILE_URL",
    ]);
  });

  it("maps Unipile rate limits to a retryable read failure", async () => {
    const gateway: UnipileDiscoveryGateway = {
      getProfile() {
        return Promise.reject(
          new UnsuccessfulRequestError(unipileRateLimitErrorBody)
        );
      },
      searchPeople() {
        return Promise.reject(
          new UnsuccessfulRequestError(unipileRateLimitErrorBody)
        );
      },
    };
    const port = createPortWithGateway(gateway);
    const result = await port.searchCandidates(
      linkedInSearchCandidatesInputFixture
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected rate-limited search to fail");
    }
    expect(result.kind).toBe("RETRYABLE_READ_FAILURE");
    expect(result.code).toBe("RATE_LIMITED");
  });

  it("backs off between retryable Unipile read attempts", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const gateway: UnipileDiscoveryGateway = {
      getProfile() {
        return Promise.reject(new Error("profile must not be called"));
      },
      searchPeople() {
        attempts += 1;
        if (attempts < 3) {
          return Promise.reject(new Error("temporary upstream failure"));
        }
        return Promise.resolve(
          parsedSearchPage(unipilePeopleSearchPageFixture)
        );
      },
    };
    const port = createPortWithGateway(gateway, authorizedDirectory, {
      sleep(milliseconds) {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });

    const result = await port.searchCandidates(
      linkedInSearchCandidatesInputFixture
    );

    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it("does not outlive the operation deadline while backing off", async () => {
    let attempts = 0;
    const gateway: UnipileDiscoveryGateway = {
      getProfile() {
        return Promise.reject(new Error("profile must not be called"));
      },
      searchPeople() {
        attempts += 1;
        return Promise.reject(new Error("temporary upstream failure"));
      },
    };
    const port = createPortWithGateway(gateway, authorizedDirectory, {
      sleep: () => Promise.race<void>([]),
    });

    const result = await port.searchCandidates({
      ...linkedInSearchCandidatesInputFixture,
      context: {
        ...providerOperationContextFixture,
        deadlineAt: parseUtcTimestamp("2026-09-17T10:00:00.001Z"),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected retry backoff deadline failure");
    }
    expect(result.kind).toBe("RETRYABLE_READ_FAILURE");
    expect(result.code).toBe("DEADLINE_EXCEEDED");
    expect(attempts).toBe(1);
  });

  it("refuses paid-only Unipile search capabilities instead of switching APIs", async () => {
    const gateway: UnipileDiscoveryGateway = {
      getProfile() {
        return Promise.reject(new Error("profile must not be called"));
      },
      searchPeople() {
        return Promise.reject(
          new UnsuccessfulRequestError(unipileSalesNavigatorRequiredErrorBody)
        );
      },
    };
    const port = createPortWithGateway(gateway);
    const result = await port.searchCandidates(
      linkedInSearchCandidatesInputFixture
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected paid-capability search to fail");
    }
    expect(result.kind).toBe("DEFINITIVE_REFUSAL");
    expect(result.code).toBe("CAPABILITY_UNAVAILABLE");
  });

  it("refuses a provider account owned by another tenant", async () => {
    const { gateway, port } = createPort();
    const result = await port.searchCandidates({
      ...linkedInSearchCandidatesInputFixture,
      account: otherTenantAccountRef,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected tenant isolation to fail closed");
    }
    expect(result.kind).toBe("DEFINITIVE_REFUSAL");
    expect(result.code).toBe("ACCOUNT_NOT_AUTHORIZED");
    expect(gateway.searchCalls).toEqual([]);
    expect(gateway.profileCalls).toEqual([]);
  });

  it("returns unavailable credentials without calling Unipile", async () => {
    const gateway = createRecordingGateway();
    const port = createUnipileLinkedInDiscoveryPort({
      apiKey: "   ",
      baseUrl: unipileDiscoveryBaseUrl,
      directory: authorizedDirectory,
      gateway,
    });
    const result = await port.readProfile(linkedInReadProfileInputFixture);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected missing credentials to fail");
    }
    expect(result.kind).toBe("UNAVAILABLE_CREDENTIALS");
    expect(gateway.profileCalls).toEqual([]);
  });

  it("rejects an out-of-bounds page size before calling Unipile", async () => {
    const { gateway, port } = createPort();
    const result = await port.searchCandidates({
      ...linkedInSearchCandidatesInputFixture,
      limit: 101,
    });

    expect(result.ok).toBe(false);
    if (result.ok || result.kind !== "INVALID_INPUT") {
      throw new Error("expected oversized page to fail as invalid input");
    }
    expect(result.field).toBe("limit");
    expect(gateway.searchCalls).toEqual([]);
  });

  it("bounds a stalled authorization lookup by the operation deadline", async () => {
    const stalled = Promise.race<boolean>([]);
    const { gateway, port } = createPort({
      directory: { isAuthorized: () => stalled },
    });
    const result = await port.searchCandidates({
      ...linkedInSearchCandidatesInputFixture,
      context: {
        ...providerOperationContextFixture,
        deadlineAt: parseUtcTimestamp("2026-09-17T10:00:00.001Z"),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected authorization deadline failure");
    }
    expect(result.kind).toBe("RETRYABLE_READ_FAILURE");
    expect(result.code).toBe("DEADLINE_EXCEEDED");
    expect(gateway.searchCalls).toEqual([]);
  });
});
