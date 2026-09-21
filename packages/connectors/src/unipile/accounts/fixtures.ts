import {
  linkedInAccountFixture,
  linkedInConnectInputFixture,
} from "@relanmo/domain";
import { parseTenantId } from "@relanmo/domain/contracts";

export const unipileAccountsBaseUrl = "https://api.unipile.example.test";
export const unipileAccountsApiKey = "unipile-test-api-key";
export const unipileHostedAuthUrl =
  "https://account.unipile.com/hosted-auth/demo";

export const unipileConnectedAccountFixture = Object.freeze({
  object: "Account",
  type: "LINKEDIN",
  id: linkedInAccountFixture.providerAccountId,
  name: linkedInConnectInputFixture.opaqueState,
  created_at: "2026-09-17T10:00:00.000Z",
  groups: [],
  sources: [
    Object.freeze({
      id: "source_messaging",
      status: "OK" as const,
    }),
  ],
  connection_params: Object.freeze({
    im: Object.freeze({
      id: "linkedin_member_demo",
      username: "camille-exemple",
      premiumContractId: null,
      premiumFeatures: Object.freeze(["premium"] as const),
    }),
  }),
});

export const unipileRestrictedAccountFixture = Object.freeze({
  ...unipileConnectedAccountFixture,
  sources: [
    Object.freeze({
      id: "source_messaging",
      status: "PERMISSIONS" as const,
    }),
  ],
});

export const unipileChallengeAccountFixture = Object.freeze({
  ...unipileConnectedAccountFixture,
  sources: [
    Object.freeze({
      id: "source_messaging",
      status: "CREDENTIALS" as const,
    }),
  ],
});

export const unipileDisconnectedAccountFixture = Object.freeze({
  ...unipileConnectedAccountFixture,
  sources: [
    Object.freeze({
      id: "source_messaging",
      status: "STOPPED" as const,
    }),
  ],
});

export type UnipileAccountFixture =
  | typeof unipileChallengeAccountFixture
  | typeof unipileConnectedAccountFixture
  | typeof unipileDisconnectedAccountFixture
  | typeof unipileRestrictedAccountFixture;

export const otherTenantId = parseTenantId("tenant_other");

export const otherTenantAccountRef = Object.freeze({
  ...linkedInAccountFixture,
  tenantId: otherTenantId,
});

export {
  linkedInAccountFixture,
  linkedInConnectInputFixture,
  linkedInReconnectInputFixture,
  providerOperationContextFixture,
} from "@relanmo/domain";
