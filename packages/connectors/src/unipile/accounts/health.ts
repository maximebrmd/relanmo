import type { LinkedInCapabilities, LinkedInHealth } from "@relanmo/domain";

export const UNIPILE_SOURCE_STATUSES = [
  "OK",
  "STOPPED",
  "ERROR",
  "CREDENTIALS",
  "PERMISSIONS",
  "CONNECTING",
] as const;
export type UnipileSourceStatus = (typeof UNIPILE_SOURCE_STATUSES)[number];

const SOURCE_PRIORITY: Readonly<Record<UnipileSourceStatus, number>> = {
  CONNECTING: 1,
  CREDENTIALS: 5,
  ERROR: 2,
  OK: 0,
  PERMISSIONS: 4,
  STOPPED: 3,
};

const inactiveCapabilities: LinkedInCapabilities = Object.freeze({
  canInvite: false,
  canReadAcceptance: false,
  canReadConversation: false,
  canReadProfiles: false,
  canSendMessages: false,
  canUseEvents: false,
  searchModes: Object.freeze({
    classic: false,
    recruiter: false,
    salesNavigator: false,
  }),
});

const unknownCapabilities: LinkedInCapabilities = Object.freeze({
  canInvite: null,
  canReadAcceptance: null,
  canReadConversation: null,
  canReadProfiles: null,
  canSendMessages: null,
  canUseEvents: null,
  searchModes: Object.freeze({
    classic: null,
    recruiter: null,
    salesNavigator: null,
  }),
});

export type UnipilePremiumFeature = "premium" | "recruiter" | "sales_navigator";

export function selectSourceStatus(
  statuses: readonly UnipileSourceStatus[]
): UnipileSourceStatus | null {
  const [first] = statuses;
  if (first === undefined) {
    return null;
  }
  let selected = first;
  for (const status of statuses) {
    if (SOURCE_PRIORITY[status] > SOURCE_PRIORITY[selected]) {
      selected = status;
    }
  }
  return selected;
}

export function normalizeAccountHealth(
  sourceStatus: UnipileSourceStatus | null,
  premiumFeatures: readonly UnipilePremiumFeature[]
): Readonly<{
  capabilities: LinkedInCapabilities;
  health: Pick<LinkedInHealth, "reason" | "status">;
}> {
  if (sourceStatus === null || sourceStatus === "CONNECTING") {
    return Object.freeze({
      capabilities: unknownCapabilities,
      health: Object.freeze({
        reason: "NOT_OBSERVED",
        status: "UNKNOWN",
      }),
    });
  }

  if (sourceStatus === "CREDENTIALS") {
    return Object.freeze({
      capabilities: inactiveCapabilities,
      health: Object.freeze({
        reason: "CHALLENGE_REQUIRED",
        status: "CHALLENGE_REQUIRED",
      }),
    });
  }

  if (sourceStatus === "PERMISSIONS" || sourceStatus === "ERROR") {
    return Object.freeze({
      capabilities: inactiveCapabilities,
      health: Object.freeze({
        reason: "ACCOUNT_RESTRICTED",
        status: "LIMITED",
      }),
    });
  }

  if (sourceStatus === "STOPPED") {
    return Object.freeze({
      capabilities: inactiveCapabilities,
      health: Object.freeze({
        reason: "DISCONNECTED",
        status: "DISCONNECTED",
      }),
    });
  }

  return Object.freeze({
    capabilities: Object.freeze({
      canInvite: true,
      canReadAcceptance: true,
      canReadConversation: true,
      canReadProfiles: true,
      canSendMessages: true,
      canUseEvents: true,
      searchModes: Object.freeze({
        classic: true,
        recruiter: premiumFeatures.includes("recruiter"),
        salesNavigator: premiumFeatures.includes("sales_navigator"),
      }),
    }),
    health: Object.freeze({
      reason: null,
      status: "CONNECTED",
    }),
  });
}
