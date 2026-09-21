import {
  providerDefinitiveRefusal,
  providerInvalidInput,
  providerRetryableReadFailure,
  providerSuccess,
  providerUnavailableCredentials,
} from "@relanmo/domain";
import type {
  LinkedInAccountRef,
  LinkedInCandidate,
  LinkedInCandidatePage,
  LinkedInDiscoveryPort,
  LinkedInProfileSnapshot,
  LinkedInReadProfileInput,
  LinkedInSearchCandidatesInput,
  LinkedInSearchQuery,
  ProviderOperationContext,
  ProviderReadResult,
} from "@relanmo/domain";
import { parseUtcTimestamp } from "@relanmo/domain/contracts";

import type { UnipileAccountDirectory } from "../accounts/bindings";
import {
  caughtError,
  deadlineExceededError,
  inspectProviderError,
  isDeadlineExceeded,
} from "../accounts/parse";
import { createSdkGateway } from "./gateway";
import type {
  UnipileAdvancedKeywords,
  UnipileDiscoveryGateway,
  UnipilePeopleSearchRequest,
} from "./gateway";
import { isPaidLinkedInCapabilityMessage, missingProfileFields } from "./parse";
import type { UnipileObservedPersonFacts } from "./parse";

export type { UnipileAccountDirectory } from "../accounts/bindings";
export {
  unipileDiscoveryApiKey,
  unipileDiscoveryBaseUrl,
  unipileLinkedInProfileFixture,
  unipilePeopleSearchEmptyPageFixture,
  unipilePeopleSearchPageFixture,
  unipileSparseLinkedInProfileFixture,
} from "./fixtures";
export type {
  UnipileDiscoveryGateway,
  UnipilePeopleSearchRequest,
} from "./gateway";

export const unipileDiscoverySurface = "ENABLED" as const;
export const UNIPILE_DISCOVERY_READ_ATTEMPTS = 3;
export const UNIPILE_DISCOVERY_READ_BACKOFF_MS = 100;
export const UNIPILE_CLASSIC_PEOPLE_PAGE_LIMIT = 10;
export const UNIPILE_DISCOVERY_MAX_PAGE_LIMIT = 100;

export type UnipileDiscoveryConfig = Readonly<{
  apiKey: string;
  baseUrl: string;
  clock?: () => Date;
  directory: UnipileAccountDirectory;
  gateway?: UnipileDiscoveryGateway;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export type LocationFilters = Readonly<{
  ids: readonly string[];
  names: readonly string[];
}>;

function deadlineReached(deadlineAt: string, now: Date): boolean {
  return Date.parse(deadlineAt) <= now.getTime();
}

function timestampFrom(now: Date) {
  return parseUtcTimestamp(now.toISOString());
}

function redactSecrets(text: string, secrets: readonly string[]): string {
  let redacted = text;
  for (const secret of secrets) {
    if (secret.trim().length === 0) {
      continue;
    }
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

function joinQueryValues(values: readonly string[]): string | undefined {
  const joined = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
  return joined.length === 0 ? undefined : joined;
}

function locationFilters(locations: readonly string[]): LocationFilters {
  const ids: string[] = [];
  const names: string[] = [];
  for (const location of locations) {
    const trimmed = location.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (/^\d+$/u.test(trimmed)) {
      ids.push(trimmed);
    } else {
      names.push(trimmed);
    }
  }
  const filters: LocationFilters = { ids, names };
  return filters;
}

interface MutablePeopleSearchRequest {
  accountId: string;
  advancedKeywords?: UnipileAdvancedKeywords;
  api: "classic";
  category: "people";
  cursor: string | null;
  keywords?: string;
  limit: number;
  location?: readonly string[];
}

function classicSearchRequest(
  input: LinkedInSearchCandidatesInput
): UnipilePeopleSearchRequest {
  const query: LinkedInSearchQuery = input.query;
  const locations = locationFilters(query.locations);
  const keywords = joinQueryValues([...query.keywords, ...locations.names]);
  const title = joinQueryValues(query.titles);
  const company = joinQueryValues(query.currentCompanies);
  const request: MutablePeopleSearchRequest = {
    accountId: input.account.providerAccountId,
    api: "classic",
    category: "people",
    cursor: input.cursor,
    limit: Math.min(input.limit, UNIPILE_CLASSIC_PEOPLE_PAGE_LIMIT),
  };
  if (company !== undefined || title !== undefined) {
    const advancedKeywords: UnipileAdvancedKeywords = {};
    if (company !== undefined) {
      advancedKeywords.company = company;
    }
    if (title !== undefined) {
      advancedKeywords.title = title;
    }
    request.advancedKeywords = advancedKeywords;
  }
  if (keywords !== undefined) {
    request.keywords = keywords;
  }
  if (locations.ids.length > 0) {
    request.location = locations.ids;
  }
  return request;
}

function candidateFromFacts(
  facts: UnipileObservedPersonFacts,
  observedAt: LinkedInCandidate["observedAt"]
): LinkedInCandidate {
  return {
    currentCompany: facts.currentCompany,
    currentRole: facts.currentRole,
    displayName: facts.displayName,
    headline: facts.headline,
    location: facts.location,
    missingFields: missingProfileFields(facts),
    observedAt,
    profileUrl: facts.profileUrl,
    providerProfileId: facts.providerProfileId,
    provenance: "SEARCH_RESULT",
  };
}

function profileFromFacts(
  facts: UnipileObservedPersonFacts,
  observedAt: LinkedInProfileSnapshot["observedAt"]
): LinkedInProfileSnapshot {
  return {
    currentCompany: facts.currentCompany,
    currentRole: facts.currentRole,
    displayName: facts.displayName,
    headline: facts.headline,
    location: facts.location,
    missingFields: missingProfileFields(facts),
    observedAt,
    profileUrl: facts.profileUrl,
    providerProfileId: facts.providerProfileId,
    provenance: "PROFILE_READ",
  };
}

type DeadlineTimer = Readonly<{
  cancel: () => void;
  promise: Promise<never>;
}>;

/* oxlint-disable promise/avoid-new -- A provider call is raced against a cancellable timer so the deadline can fire without leaking the timeout. */
function rejectAfterDeadline(milliseconds: number): DeadlineTimer {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(deadlineExceededError());
    }, milliseconds);
  });
  return {
    cancel() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    },
    promise,
  };
}
/* oxlint-enable promise/avoid-new */

/* oxlint-disable promise/avoid-new -- The retry policy needs an awaitable timer between provider reads. */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
/* oxlint-enable promise/avoid-new */

class UnipileLinkedInDiscovery implements LinkedInDiscoveryPort {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #clock: () => Date;
  readonly #directory: UnipileAccountDirectory;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  #gateway: UnipileDiscoveryGateway | undefined;

  constructor(config: UnipileDiscoveryConfig) {
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl;
    this.#clock = config.clock ?? (() => new Date());
    this.#directory = config.directory;
    this.#gateway = config.gateway;
    this.#sleep = config.sleep ?? sleep;
  }

  async searchCandidates(
    input: LinkedInSearchCandidatesInput
  ): Promise<ProviderReadResult<LinkedInCandidatePage>> {
    const credentials = this.#missingCredentials(input.context);
    if (credentials) {
      return credentials;
    }
    if (input.account.providerAccountId.trim().length === 0) {
      return providerInvalidInput(
        input.context,
        "providerAccountId",
        "providerAccountId must not be empty"
      );
    }
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > UNIPILE_DISCOVERY_MAX_PAGE_LIMIT
    ) {
      return providerInvalidInput(
        input.context,
        "limit",
        "limit must be between 1 and 100",
        "OUT_OF_BOUNDS"
      );
    }
    try {
      const binding = await this.#authorize(input.account, input.context);
      if (binding) {
        return binding;
      }
      const page = await this.#readWithRetry(
        () => this.#getGateway().searchPeople(classicSearchRequest(input)),
        input.context
      );
      const observedAt = timestampFrom(this.#clock());
      const candidates = page.people.map((person) =>
        candidateFromFacts(person, observedAt)
      );
      return providerSuccess(input.context, {
        candidates,
        exhausted: page.cursor === null,
        nextCursor: page.cursor,
        observedAt,
      });
    } catch (error) {
      return this.#readFailure(input.context, caughtError(error));
    }
  }

  async readProfile(
    input: LinkedInReadProfileInput
  ): Promise<ProviderReadResult<LinkedInProfileSnapshot>> {
    const credentials = this.#missingCredentials(input.context);
    if (credentials) {
      return credentials;
    }
    if (input.account.providerAccountId.trim().length === 0) {
      return providerInvalidInput(
        input.context,
        "providerAccountId",
        "providerAccountId must not be empty"
      );
    }
    if (input.providerProfileId.trim().length === 0) {
      return providerInvalidInput(
        input.context,
        "providerProfileId",
        "providerProfileId must not be empty"
      );
    }
    try {
      const binding = await this.#authorize(input.account, input.context);
      if (binding) {
        return binding;
      }
      const facts = await this.#readWithRetry(
        () =>
          this.#getGateway().getProfile({
            accountId: input.account.providerAccountId,
            identifier: input.providerProfileId,
          }),
        input.context
      );
      return providerSuccess(
        input.context,
        profileFromFacts(facts, timestampFrom(this.#clock()))
      );
    } catch (error) {
      return this.#readFailure(input.context, caughtError(error));
    }
  }

  async #authorize(
    account: LinkedInAccountRef,
    context: ProviderOperationContext
  ) {
    let authorized: boolean;
    try {
      authorized = await this.#withDeadline(
        Promise.resolve(
          this.#directory.isAuthorized(
            account.providerAccountId,
            account.tenantId
          )
        ),
        context.deadlineAt
      );
    } catch (error) {
      const failure = caughtError(error);
      if (isDeadlineExceeded(failure)) {
        throw failure;
      }
      throw new Error("account authorization is temporarily unavailable", {
        cause: error,
      });
    }
    if (!authorized) {
      return providerDefinitiveRefusal(
        context,
        "ACCOUNT_NOT_AUTHORIZED",
        "provider account is not authorized for this tenant"
      );
    }
    return null;
  }

  async #readWithRetry<Value>(
    operation: () => Promise<Value>,
    context: ProviderOperationContext
  ): Promise<Value> {
    let lastError: Error = new Error("Unipile discovery read failed");
    /* oxlint-disable no-await-in-loop -- Bounded Unipile reads retry sequentially until success, a 4xx, or the attempt cap. */
    for (
      let attempt = 1;
      attempt <= UNIPILE_DISCOVERY_READ_ATTEMPTS;
      attempt += 1
    ) {
      if (deadlineReached(context.deadlineAt, this.#clock())) {
        throw deadlineExceededError();
      }
      try {
        return await this.#withDeadline(operation(), context.deadlineAt);
      } catch (error) {
        lastError = caughtError(error);
        const inspected = inspectProviderError(lastError);
        if (
          inspected.status !== null &&
          inspected.status < 500 &&
          inspected.status !== 0
        ) {
          throw lastError;
        }
        if (attempt === UNIPILE_DISCOVERY_READ_ATTEMPTS) {
          throw lastError;
        }
        await this.#withDeadline(
          this.#sleep(
            UNIPILE_DISCOVERY_READ_BACKOFF_MS * 2 ** (attempt - 1)
          ),
          context.deadlineAt
        );
      }
    }
    /* oxlint-enable no-await-in-loop */
    throw lastError;
  }

  async #withDeadline<Value>(
    work: Promise<Value>,
    deadlineAt: ProviderOperationContext["deadlineAt"]
  ): Promise<Value> {
    const remaining = Date.parse(deadlineAt) - this.#clock().getTime();
    if (remaining <= 0) {
      throw deadlineExceededError();
    }
    const timeout = rejectAfterDeadline(remaining);
    try {
      return await Promise.race([work, timeout.promise]);
    } finally {
      timeout.cancel();
    }
  }

  #missingCredentials(context: ProviderOperationContext) {
    if (this.#apiKey.trim().length === 0 || this.#baseUrl.trim().length === 0) {
      return providerUnavailableCredentials(context, "LINKEDIN", "APPLICATION");
    }
    return null;
  }

  #getGateway(): UnipileDiscoveryGateway {
    this.#gateway ??= createSdkGateway(this.#baseUrl, this.#apiKey);
    return this.#gateway;
  }

  #readFailure<Value>(
    context: ProviderOperationContext,
    error: Error
  ): ProviderReadResult<Value> {
    if (isDeadlineExceeded(error)) {
      return providerRetryableReadFailure(
        context,
        "DEADLINE_EXCEEDED",
        this.#redact(error.message)
      );
    }
    const inspected = inspectProviderError(error);
    const message = this.#redact(inspected.message);
    if (isPaidLinkedInCapabilityMessage(inspected.message)) {
      return providerDefinitiveRefusal(
        context,
        "CAPABILITY_UNAVAILABLE",
        message
      );
    }
    if (inspected.status === 401 || inspected.status === 403) {
      return providerUnavailableCredentials(context, "LINKEDIN", "APPLICATION");
    }
    if (inspected.status === 404) {
      return providerDefinitiveRefusal(context, "NOT_FOUND", message);
    }
    if (inspected.status === 429) {
      return providerRetryableReadFailure(context, "RATE_LIMITED", message);
    }
    if (
      inspected.status !== null &&
      inspected.status >= 400 &&
      inspected.status < 500
    ) {
      return providerDefinitiveRefusal(
        context,
        "PROVIDER_POLICY_REJECTED",
        message
      );
    }
    return providerRetryableReadFailure(
      context,
      "UPSTREAM_READ_FAILURE",
      message
    );
  }

  #redact(message: string): string {
    return redactSecrets(message, [this.#apiKey]);
  }
}

export function createUnipileLinkedInDiscoveryPort(
  config: UnipileDiscoveryConfig
): LinkedInDiscoveryPort {
  return new UnipileLinkedInDiscovery(config);
}
