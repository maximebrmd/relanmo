import type {
  LinkedInAccountsPort,
  LinkedInConnectInput,
  ProviderReadResult,
  ProviderWriteResult,
} from "@relanmo/domain";
import { parseUtcTimestamp } from "@relanmo/domain/contracts";
import { describe, expect, it } from "vitest";

import type { UnipileAccountFixture } from "./fixtures";
import {
  linkedInAccountFixture,
  linkedInConnectInputFixture,
  linkedInReconnectInputFixture,
  otherTenantAccountRef,
  providerOperationContextFixture,
  unipileAccountsApiKey,
  unipileAccountsBaseUrl,
  unipileChallengeAccountFixture,
  unipileConnectedAccountFixture,
  unipileDisconnectedAccountFixture,
  unipileHostedAuthUrl,
  unipileRestrictedAccountFixture,
} from "./fixtures";
import { createUnipileLinkedInAccountsPort } from "./index";
import type {
  UnipileAccountDirectory,
  UnipileAccountsGateway,
  UnipileHostedAuthRequest,
} from "./index";
import type { UnipileLinkedInAccountSnapshot } from "./parse";
import { parseLinkedInAccount } from "./parse";

function readValue<Value>(result: ProviderReadResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

function writeValue<Value>(result: ProviderWriteResult<Value>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.value;
}

function snapshotFor(
  fixture: UnipileAccountFixture
): UnipileLinkedInAccountSnapshot {
  const snapshot = parseLinkedInAccount(fixture);
  if (snapshot === null) {
    throw new Error("fixture must parse as a LinkedIn account");
  }
  return snapshot;
}

type RecordingGateway = UnipileAccountsGateway & {
  getAccountCalls: string[];
  hostedAuthCalls: UnipileHostedAuthRequest[];
};

type PortHarness = Readonly<{
  gateway: RecordingGateway;
  port: LinkedInAccountsPort;
}>;

const authorizedDirectory: UnipileAccountDirectory = {
  isAuthorized(providerAccountId, tenantId) {
    return (
      providerAccountId === linkedInAccountFixture.providerAccountId &&
      tenantId === linkedInAccountFixture.tenantId
    );
  },
};

function createRecordingGateway(
  fixture: UnipileAccountFixture = unipileConnectedAccountFixture
): RecordingGateway {
  const hostedAuthCalls: UnipileHostedAuthRequest[] = [];
  const getAccountCalls: string[] = [];
  return {
    hostedAuthCalls,
    getAccountCalls,
    createHostedAuthLink(input) {
      hostedAuthCalls.push(input);
      return Promise.resolve({ url: unipileHostedAuthUrl });
    },
    getAccount(accountId) {
      getAccountCalls.push(accountId);
      return Promise.resolve(snapshotFor(fixture));
    },
  };
}

function createPort(options?: {
  directory?: UnipileAccountDirectory;
  fixture?: UnipileAccountFixture;
  hostedFlowTtlMs?: number;
  now?: string;
}): PortHarness {
  const gateway = createRecordingGateway(
    options?.fixture ?? unipileConnectedAccountFixture
  );
  const now = options?.now ?? "2026-09-17T10:00:00.000Z";
  return {
    gateway,
    port: createUnipileLinkedInAccountsPort({
      apiKey: unipileAccountsApiKey,
      baseUrl: unipileAccountsBaseUrl,
      clock: () => new Date(now),
      directory: options?.directory ?? authorizedDirectory,
      gateway,
      hostedFlowTtlMs: options?.hostedFlowTtlMs,
    }),
  };
}

describe("Unipile LinkedIn accounts adapter", () => {
  it("issues a LinkedIn-only hosted connection link bound to opaque tenant state", async () => {
    const { gateway, port } = createPort();
    const flow = writeValue(
      await port.createConnectFlow(linkedInConnectInputFixture)
    );

    expect(flow.mode).toBe("CONNECT");
    expect(flow.authorizationUrl).toBe(unipileHostedAuthUrl);
    expect(flow.expiresAt).toBe("2026-09-17T10:20:00.000Z");
    expect(flow.expiresAt).not.toBe(providerOperationContextFixture.deadlineAt);
    expect(flow.flowReference).toBe(linkedInConnectInputFixture.opaqueState);
    expect(gateway.hostedAuthCalls).toEqual([
      {
        api_url: unipileAccountsBaseUrl,
        expiresOn: "2026-09-17T10:20:00.000Z",
        failure_redirect_url: linkedInConnectInputFixture.callbackUrl,
        name: linkedInConnectInputFixture.opaqueState,
        providers: ["LINKEDIN"],
        success_redirect_url: linkedInConnectInputFixture.callbackUrl,
        type: "create",
      },
    ]);
  });

  it("issues a reconnect link for the authorized provider account", async () => {
    const { gateway, port } = createPort({ hostedFlowTtlMs: 20 * 60 * 1000 });
    const flow = writeValue(
      await port.createReconnectFlow(linkedInReconnectInputFixture)
    );

    expect(flow.mode).toBe("RECONNECT");
    expect(flow.authorizationUrl).toBe(unipileHostedAuthUrl);
    expect(flow.expiresAt).toBe("2026-09-17T10:25:00.000Z");
    expect(gateway.hostedAuthCalls[0]).toMatchObject({
      expiresOn: "2026-09-17T10:25:00.000Z",
      reconnect_account: linkedInAccountFixture.providerAccountId,
      type: "reconnect",
      name: linkedInReconnectInputFixture.opaqueState,
    });
    expect(gateway.hostedAuthCalls[0]).not.toHaveProperty("providers");
  });

  it("keeps hosted link expiration beyond a longer operation deadline", async () => {
    const { gateway, port } = createPort();
    const deadlineAt = parseUtcTimestamp("2026-09-17T10:20:00.000Z");
    const flow = writeValue(
      await port.createConnectFlow({
        ...linkedInConnectInputFixture,
        context: {
          ...providerOperationContextFixture,
          deadlineAt,
        },
      })
    );

    expect(flow.expiresAt).toBe("2026-09-17T10:35:00.000Z");
    expect(Date.parse(flow.expiresAt)).toBeGreaterThan(Date.parse(deadlineAt));
    expect(gateway.hostedAuthCalls[0]).toMatchObject({
      expiresOn: flow.expiresAt,
    });
  });

  it("rejects an expired hosted flow before calling Unipile", async () => {
    const { gateway, port } = createPort({
      now: "2026-09-17T10:05:00.000Z",
    });
    const expired: LinkedInConnectInput = {
      ...linkedInConnectInputFixture,
      context: {
        ...providerOperationContextFixture,
        deadlineAt: parseUtcTimestamp("2026-09-17T10:05:00.000Z"),
      },
    };

    const result = await port.createConnectFlow(expired);
    expect(result.ok).toBe(false);
    if (result.ok || result.kind !== "INVALID_INPUT") {
      throw new Error("expected expired flow to fail as invalid input");
    }
    expect(result.field).toBe("deadlineAt");
    expect(gateway.hostedAuthCalls).toEqual([]);
  });

  it("normalizes a connected account without dropping observed capabilities", async () => {
    const { port } = createPort();
    const status = readValue(
      await port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );

    expect(status.account).toEqual(linkedInAccountFixture);
    expect(status.health.status).toBe("CONNECTED");
    expect(status.health.reason).toBeNull();
    expect(status.capabilities.canInvite).toBe(true);
    expect(status.capabilities.searchModes.classic).toBe(true);
    expect(status.capabilities.searchModes.salesNavigator).toBe(false);
    expect(status.capabilities.searchModes.recruiter).toBe(false);
  });

  it("keeps restricted, challenge and disconnected accounts visible for owner action", async () => {
    const restricted = readValue(
      await createPort({
        fixture: unipileRestrictedAccountFixture,
      }).port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );
    expect(restricted.health.status).toBe("LIMITED");
    expect(restricted.health.reason).toBe("ACCOUNT_RESTRICTED");
    expect(restricted.capabilities.canSendMessages).toBe(false);

    const challenge = readValue(
      await createPort({
        fixture: unipileChallengeAccountFixture,
      }).port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );
    expect(challenge.health.status).toBe("CHALLENGE_REQUIRED");
    expect(challenge.health.reason).toBe("CHALLENGE_REQUIRED");

    const disconnected = readValue(
      await createPort({
        fixture: unipileDisconnectedAccountFixture,
      }).port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );
    expect(disconnected.health.status).toBe("DISCONNECTED");
    expect(disconnected.health.reason).toBe("DISCONNECTED");
  });

  it("refuses a provider account owned by another tenant", async () => {
    const owner = createPort();
    readValue(
      await owner.port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );

    const interloper = createPort();
    const rebound = await interloper.port.readAccountStatus({
      account: otherTenantAccountRef,
      context: providerOperationContextFixture,
    });
    expect(rebound.ok).toBe(false);
    if (rebound.ok) {
      throw new Error("expected tenant rebinding to fail");
    }
    expect(rebound.kind).toBe("DEFINITIVE_REFUSAL");
    expect(rebound.code).toBe("ACCOUNT_NOT_AUTHORIZED");

    const stolenReconnect = await interloper.port.createReconnectFlow({
      ...linkedInReconnectInputFixture,
      account: otherTenantAccountRef,
    });
    expect(stolenReconnect.ok).toBe(false);
    if (stolenReconnect.ok) {
      throw new Error("expected stolen reconnect to fail");
    }
    expect(stolenReconnect.code).toBe("ACCOUNT_NOT_AUTHORIZED");
  });

  it("refuses an unowned provider account without calling Unipile", async () => {
    const gateway = createRecordingGateway();
    const port = createUnipileLinkedInAccountsPort({
      apiKey: unipileAccountsApiKey,
      baseUrl: unipileAccountsBaseUrl,
      clock: () => new Date("2026-09-17T10:00:00.000Z"),
      directory: { isAuthorized: () => false },
      gateway,
    });
    const result = await port.readAccountStatus({
      account: linkedInAccountFixture,
      context: providerOperationContextFixture,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected unowned account to fail");
    }
    expect(result.code).toBe("ACCOUNT_NOT_AUTHORIZED");
    expect(gateway.getAccountCalls).toEqual([]);
  });

  it("normalizes authorization store failures without calling Unipile", async () => {
    const directory: UnipileAccountDirectory = {
      isAuthorized: () => Promise.reject(new Error("database unavailable")),
    };
    const { gateway, port } = createPort({ directory });

    const read = await port.readAccountStatus({
      account: linkedInAccountFixture,
      context: providerOperationContextFixture,
    });
    expect(read.ok).toBe(false);
    if (read.ok) {
      throw new Error("expected authorization read failure");
    }
    expect(read.kind).toBe("RETRYABLE_READ_FAILURE");
    expect(read.code).toBe("UPSTREAM_READ_FAILURE");

    const reconnect = await port.createReconnectFlow(
      linkedInReconnectInputFixture
    );
    expect(reconnect.ok).toBe(false);
    if (reconnect.ok) {
      throw new Error("expected authorization write failure");
    }
    expect(reconnect.kind).toBe("DEFINITIVE_REFUSAL");
    expect(reconnect.code).toBe("CAPABILITY_UNAVAILABLE");
    expect(gateway.getAccountCalls).toEqual([]);
    expect(gateway.hostedAuthCalls).toEqual([]);
  });

  it("bounds a stalled authorization lookup by the operation deadline", async () => {
    const stalled = Promise.withResolvers<boolean>().promise;
    const deadlineAt = parseUtcTimestamp("2026-09-17T10:00:00.001Z");
    const { gateway, port } = createPort({
      directory: { isAuthorized: () => stalled },
    });
    const result = await port.createReconnectFlow({
      ...linkedInReconnectInputFixture,
      context: {
        ...providerOperationContextFixture,
        deadlineAt,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected authorization deadline failure");
    }
    expect(result.kind).toBe("DEFINITIVE_REFUSAL");
    expect(result.code).toBe("CAPABILITY_UNAVAILABLE");
    expect(gateway.hostedAuthCalls).toEqual([]);
  });

  it("retries bounded Unipile reads and redacts credentials from failures", async () => {
    let attempts = 0;
    const gateway: UnipileAccountsGateway = {
      createHostedAuthLink() {
        return Promise.resolve({ url: unipileHostedAuthUrl });
      },
      getAccount() {
        attempts += 1;
        return Promise.reject(
          new Error(`upstream failed using ${unipileAccountsApiKey}`)
        );
      },
    };
    const port = createUnipileLinkedInAccountsPort({
      apiKey: unipileAccountsApiKey,
      baseUrl: unipileAccountsBaseUrl,
      clock: () => new Date("2026-09-17T10:00:00.000Z"),
      directory: authorizedDirectory,
      gateway,
    });
    const result = await port.readAccountStatus({
      account: linkedInAccountFixture,
      context: providerOperationContextFixture,
    });

    expect(attempts).toBe(3);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected retryable read failure");
    }
    expect(result.kind).toBe("RETRYABLE_READ_FAILURE");
    expect(result.code).toBe("UPSTREAM_READ_FAILURE");
    expect(result.message).not.toContain(unipileAccountsApiKey);
  });

  it("returns unavailable credentials without calling Unipile", async () => {
    const port = createUnipileLinkedInAccountsPort({
      apiKey: "   ",
      baseUrl: unipileAccountsBaseUrl,
      directory: authorizedDirectory,
    });
    const result = await port.createConnectFlow(linkedInConnectInputFixture);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected missing credentials to fail");
    }
    expect(result.kind).toBe("UNAVAILABLE_CREDENTIALS");
  });
});
