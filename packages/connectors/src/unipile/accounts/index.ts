import {
  providerAmbiguousWrite,
  providerDefinitiveRefusal,
  providerInvalidInput,
  providerRetryableReadFailure,
  providerSuccess,
  providerUnavailableCredentials,
} from "@relanmo/domain";
import type {
  LinkedInAccountRef,
  LinkedInAccountsPort,
  LinkedInAccountStatus,
  LinkedInAccountStatusInput,
  LinkedInConnectInput,
  LinkedInHostedFlow,
  LinkedInReconnectInput,
  ProviderOperationContext,
  ProviderReadResult,
  ProviderWriteResult,
} from "@relanmo/domain";
import { parseUtcTimestamp } from "@relanmo/domain/contracts";

import { MemoryUnipileAccountDirectory } from "./bindings";
import type { UnipileAccountDirectory } from "./bindings";
import { normalizeAccountHealth } from "./health";
import { createSdkGateway, withNotifyUrl } from "./hosted";
import type {
  UnipileAccountsGateway,
  UnipileHostedAuthRequest,
} from "./hosted";
import {
  caughtError,
  deadlineExceededError,
  inspectProviderError,
  isDeadlineExceeded,
} from "./parse";
import type { UnipileLinkedInAccountSnapshot } from "./parse";

export {
  MemoryUnipileAccountDirectory,
  type UnipileAccountBindingResult,
  type UnipileAccountDirectory,
} from "./bindings";
export {
  unipileAccountsApiKey,
  unipileAccountsBaseUrl,
  unipileChallengeAccountFixture,
  unipileConnectedAccountFixture,
  unipileDisconnectedAccountFixture,
  unipileHostedAuthUrl,
  unipileRestrictedAccountFixture,
} from "./fixtures";
export type {
  UnipileAccountsGateway,
  UnipileHostedAuthRequest,
} from "./hosted";
export type { UnipileLinkedInAccountSnapshot } from "./parse";

export const unipileAccountsSurface = "ENABLED" as const;
export const UNIPILE_ACCOUNT_READ_ATTEMPTS = 3;

export type UnipileAccountsConfig = Readonly<{
  apiKey: string;
  baseUrl: string;
  clock?: () => Date;
  directory?: UnipileAccountDirectory;
  gateway?: UnipileAccountsGateway;
  notifyUrl?: string;
}>;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

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

function invalidFlowInput(
  input: LinkedInConnectInput | LinkedInReconnectInput
) {
  if (input.opaqueState.trim().length === 0) {
    return providerInvalidInput(
      input.context,
      "opaqueState",
      "opaqueState must not be empty"
    );
  }
  if (!isHttpUrl(input.callbackUrl)) {
    return providerInvalidInput(
      input.context,
      "callbackUrl",
      "callbackUrl must be an http(s) URL"
    );
  }
  if (
    "account" in input &&
    input.account.providerAccountId.trim().length === 0
  ) {
    return providerInvalidInput(
      input.context,
      "providerAccountId",
      "providerAccountId must not be empty"
    );
  }
  return null;
}

function expiredDeadline(context: ProviderOperationContext, clock: () => Date) {
  if (!deadlineReached(context.deadlineAt, clock())) {
    return null;
  }
  return providerInvalidInput(
    context,
    "deadlineAt",
    "hosted auth flow has expired",
    "OUT_OF_BOUNDS"
  );
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
  const timer: DeadlineTimer = {
    cancel() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    },
    promise,
  };
  return timer;
}
/* oxlint-enable promise/avoid-new */

class UnipileLinkedInAccounts implements LinkedInAccountsPort {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #clock: () => Date;
  readonly #directory: UnipileAccountDirectory;
  readonly #gateway: UnipileAccountsGateway;
  readonly #notifyUrl: string | null;

  constructor(config: UnipileAccountsConfig) {
    this.#apiKey = config.apiKey;
    this.#baseUrl = config.baseUrl;
    this.#clock = config.clock ?? (() => new Date());
    this.#directory = config.directory ?? new MemoryUnipileAccountDirectory();
    this.#gateway =
      config.gateway ?? createSdkGateway(config.baseUrl, config.apiKey);
    this.#notifyUrl = config.notifyUrl ?? null;
  }

  async createConnectFlow(
    input: LinkedInConnectInput
  ): Promise<ProviderWriteResult<LinkedInHostedFlow>> {
    const credentials = this.#missingCredentials(input.context);
    if (credentials) {
      return credentials;
    }
    const invalid = invalidFlowInput(input);
    if (invalid) {
      return invalid;
    }
    const expired = expiredDeadline(input.context, this.#clock);
    if (expired) {
      return expired;
    }
    return await this.#createFlow({
      context: input.context,
      mode: "CONNECT",
      opaqueState: input.opaqueState,
      request: withNotifyUrl(
        {
          api_url: this.#baseUrl,
          expiresOn: input.context.deadlineAt,
          failure_redirect_url: input.callbackUrl,
          name: input.opaqueState,
          providers: ["LINKEDIN"],
          success_redirect_url: input.callbackUrl,
          type: "create",
        },
        this.#notifyUrl
      ),
    });
  }

  async createReconnectFlow(
    input: LinkedInReconnectInput
  ): Promise<ProviderWriteResult<LinkedInHostedFlow>> {
    const credentials = this.#missingCredentials(input.context);
    if (credentials) {
      return credentials;
    }
    const invalid = invalidFlowInput(input);
    if (invalid) {
      return invalid;
    }
    const expired = expiredDeadline(input.context, this.#clock);
    if (expired) {
      return expired;
    }
    const binding = await this.#authorize(input.account, input.context);
    if (binding) {
      return binding;
    }
    return await this.#createFlow({
      context: input.context,
      mode: "RECONNECT",
      opaqueState: input.opaqueState,
      request: withNotifyUrl(
        {
          api_url: this.#baseUrl,
          expiresOn: input.context.deadlineAt,
          failure_redirect_url: input.callbackUrl,
          name: input.opaqueState,
          reconnect_account: input.account.providerAccountId,
          success_redirect_url: input.callbackUrl,
          type: "reconnect",
        },
        this.#notifyUrl
      ),
    });
  }

  async readAccountCapabilities(
    input: LinkedInAccountStatusInput
  ): Promise<ProviderReadResult<LinkedInAccountStatus["capabilities"]>> {
    const status = await this.readAccountStatus(input);
    if (!status.ok) {
      return status;
    }
    return providerSuccess(input.context, status.value.capabilities);
  }

  async readAccountStatus(
    input: LinkedInAccountStatusInput
  ): Promise<ProviderReadResult<LinkedInAccountStatus>> {
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
    const binding = await this.#authorize(input.account, input.context);
    if (binding) {
      return binding;
    }

    try {
      const snapshot = await this.#readAccount(
        input.account.providerAccountId,
        input.context
      );
      const observedAt = timestampFrom(this.#clock());
      const normalized = normalizeAccountHealth(
        snapshot.sourceStatus,
        snapshot.premiumFeatures
      );
      return providerSuccess(input.context, {
        account: input.account,
        capabilities: normalized.capabilities,
        health: {
          checkedAt: observedAt,
          reason: normalized.health.reason,
          status: normalized.health.status,
        },
        observedAt,
      });
    } catch (error) {
      return this.#readFailure(input.context, caughtError(error));
    }
  }

  async #authorize(
    account: LinkedInAccountRef,
    context: ProviderOperationContext
  ) {
    const result = await this.#directory.bind(
      account.providerAccountId,
      account.tenantId
    );
    if (result === "CONFLICT") {
      return providerDefinitiveRefusal(
        context,
        "ACCOUNT_NOT_AUTHORIZED",
        "provider account is bound to another tenant"
      );
    }
    return null;
  }

  async #createFlow(input: {
    context: ProviderOperationContext;
    mode: LinkedInHostedFlow["mode"];
    opaqueState: string;
    request: UnipileHostedAuthRequest;
  }): Promise<ProviderWriteResult<LinkedInHostedFlow>> {
    try {
      const response = await this.#withDeadline(
        this.#gateway.createHostedAuthLink(input.request),
        input.context.deadlineAt
      );
      if (response.url.trim().length === 0) {
        return providerAmbiguousWrite(
          input.context,
          "RESPONSE_LOST",
          this.#redact("Unipile hosted auth link was empty")
        );
      }
      return providerSuccess(input.context, {
        authorizationUrl: response.url,
        expiresAt: input.context.deadlineAt,
        flowReference: input.opaqueState,
        mode: input.mode,
      });
    } catch (error) {
      return this.#writeFailure(input.context, caughtError(error));
    }
  }

  async #readAccount(
    providerAccountId: string,
    context: ProviderOperationContext
  ): Promise<UnipileLinkedInAccountSnapshot> {
    let lastError: Error = new Error("Unipile account read failed");
    /* oxlint-disable no-await-in-loop -- Bounded Unipile reads retry sequentially until success, a 4xx, or the attempt cap. */
    for (
      let attempt = 1;
      attempt <= UNIPILE_ACCOUNT_READ_ATTEMPTS;
      attempt += 1
    ) {
      if (deadlineReached(context.deadlineAt, this.#clock())) {
        throw deadlineExceededError();
      }
      try {
        return await this.#withDeadline(
          this.#gateway.getAccount(providerAccountId),
          context.deadlineAt
        );
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
        if (attempt === UNIPILE_ACCOUNT_READ_ATTEMPTS) {
          throw lastError;
        }
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

  #readFailure(
    context: ProviderOperationContext,
    error: Error
  ): ProviderReadResult<LinkedInAccountStatus> {
    if (isDeadlineExceeded(error)) {
      return providerRetryableReadFailure(
        context,
        "DEADLINE_EXCEEDED",
        this.#redact(error.message)
      );
    }
    const inspected = inspectProviderError(error);
    if (inspected.status === 401 || inspected.status === 403) {
      return providerUnavailableCredentials(context, "LINKEDIN", "APPLICATION");
    }
    if (inspected.status === 404) {
      return providerDefinitiveRefusal(
        context,
        "NOT_FOUND",
        this.#redact(inspected.message)
      );
    }
    if (inspected.status === 429) {
      return providerRetryableReadFailure(
        context,
        "RATE_LIMITED",
        this.#redact(inspected.message)
      );
    }
    if (
      inspected.status !== null &&
      inspected.status >= 400 &&
      inspected.status < 500
    ) {
      return providerDefinitiveRefusal(
        context,
        "PROVIDER_POLICY_REJECTED",
        this.#redact(inspected.message)
      );
    }
    return providerRetryableReadFailure(
      context,
      "UPSTREAM_READ_FAILURE",
      this.#redact(inspected.message)
    );
  }

  #writeFailure(
    context: ProviderOperationContext,
    error: Error
  ): ProviderWriteResult<LinkedInHostedFlow> {
    if (isDeadlineExceeded(error)) {
      return providerAmbiguousWrite(
        context,
        "DEADLINE_EXCEEDED",
        this.#redact(error.message)
      );
    }
    const inspected = inspectProviderError(error);
    if (inspected.status === 401 || inspected.status === 403) {
      return providerUnavailableCredentials(context, "LINKEDIN", "APPLICATION");
    }
    if (inspected.status === 404) {
      return providerDefinitiveRefusal(
        context,
        "NOT_FOUND",
        this.#redact(inspected.message)
      );
    }
    if (
      inspected.status !== null &&
      inspected.status >= 400 &&
      inspected.status < 500
    ) {
      return providerDefinitiveRefusal(
        context,
        "PROVIDER_POLICY_REJECTED",
        this.#redact(inspected.message)
      );
    }
    return providerAmbiguousWrite(
      context,
      "TRANSPORT_ERROR",
      this.#redact(inspected.message)
    );
  }

  #redact(message: string): string {
    return redactSecrets(message, [this.#apiKey]);
  }
}

export function createUnipileLinkedInAccountsPort(
  config: UnipileAccountsConfig
): LinkedInAccountsPort {
  return new UnipileLinkedInAccounts(config);
}
