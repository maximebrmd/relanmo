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
import {
  createUnipileLinkedInAccountsPort,
  MemoryUnipileAccountDirectory,
} from "./index";
import type { UnipileAccountsGateway, UnipileHostedAuthRequest } from "./index";
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
  directory?: MemoryUnipileAccountDirectory;
  fixture?: UnipileAccountFixture;
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
      directory: options?.directory ?? new MemoryUnipileAccountDirectory(),
      gateway,
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
    expect(flow.expiresAt).toBe(providerOperationContextFixture.deadlineAt);
    expect(flow.flowReference).toBe(linkedInConnectInputFixture.opaqueState);
    expect(gateway.hostedAuthCalls).toEqual([
      {
        api_url: unipileAccountsBaseUrl,
        expiresOn: providerOperationContextFixture.deadlineAt,
        failure_redirect_url: linkedInConnectInputFixture.callbackUrl,
        name: linkedInConnectInputFixture.opaqueState,
        providers: ["LINKEDIN"],
        success_redirect_url: linkedInConnectInputFixture.callbackUrl,
        type: "create",
      },
    ]);
  });

  it("issues a reconnect link for the authorized provider account", async () => {
    const { gateway, port } = createPort();
    const flow = writeValue(
      await port.createReconnectFlow(linkedInReconnectInputFixture)
    );

    expect(flow.mode).toBe("RECONNECT");
    expect(flow.authorizationUrl).toBe(unipileHostedAuthUrl);
    expect(gateway.hostedAuthCalls[0]).toMatchObject({
      reconnect_account: linkedInAccountFixture.providerAccountId,
      type: "reconnect",
      name: linkedInReconnectInputFixture.opaqueState,
    });
    expect(gateway.hostedAuthCalls[0]).not.toHaveProperty("providers");
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

  it("refuses to rebind a provider account to another tenant", async () => {
    const directory = new MemoryUnipileAccountDirectory();
    const owner = createPort({ directory });
    readValue(
      await owner.port.readAccountStatus({
        account: linkedInAccountFixture,
        context: providerOperationContextFixture,
      })
    );

    const interloper = createPort({ directory });
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
    const gateway = createRecordingGateway();
    const port = createUnipileLinkedInAccountsPort({
      apiKey: "   ",
      baseUrl: unipileAccountsBaseUrl,
      gateway,
    });
    const result = await port.createConnectFlow(linkedInConnectInputFixture);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected missing credentials to fail");
    }
    expect(result.kind).toBe("UNAVAILABLE_CREDENTIALS");
    expect(gateway.hostedAuthCalls).toEqual([]);
  });
});
