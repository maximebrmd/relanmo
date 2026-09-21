import { describe, expect, it } from "vitest";

import { auditEvents, usageEvents } from "./audit";
import {
  billingCustomers,
  billingEntitlements,
  billingEvents,
  subscriptions,
} from "./billing";
import { campaigns, campaignVersions } from "./campaigns";
import {
  accountLeases,
  actionEvents,
  actions,
  outboxEvents,
  quotaReservations,
  sendAttempts,
  sendReceipts,
  webhookEvents,
} from "./delivery";
import {
  conversations,
  evidence,
  messages,
  prospects,
  providerAccounts,
  suppressionEntries,
} from "./leads";
import {
  promptOverrides,
  promptOverrideVersions,
  styleProfiles,
  styleProfileVersions,
} from "./styles";
import { expectForeignKey } from "./test-helpers";

const TENANT_SCOPED_TABLES = [
  { column: "tenant_id", table: campaigns },
  { column: "tenant_id", table: campaignVersions },
  { column: "tenant_id", table: styleProfiles },
  { column: "tenant_id", table: styleProfileVersions },
  { column: "tenant_id", table: promptOverrides },
  { column: "tenant_id", table: promptOverrideVersions },
  { column: "tenant_id", table: providerAccounts },
  { column: "tenant_id", table: prospects },
  { column: "tenant_id", table: evidence },
  { column: "tenant_id", table: conversations },
  { column: "tenant_id", table: messages },
  { column: "tenant_id", table: suppressionEntries },
  { column: "tenant_id", table: actions },
  { column: "tenant_id", table: sendAttempts },
  { column: "tenant_id", table: sendReceipts },
  { column: "tenant_id", table: accountLeases },
  { column: "tenant_id", table: quotaReservations },
  { column: "tenant_id", table: webhookEvents },
  { column: "tenant_id", table: outboxEvents },
  { column: "tenant_id", table: actionEvents },
  { column: "tenant_id", table: billingCustomers },
  { column: "tenant_id", table: subscriptions },
  { column: "tenant_id", table: billingEntitlements },
  { column: "tenant_id", table: billingEvents },
  { column: "tenant_id", table: usageEvents },
  { column: "tenant_id", table: auditEvents },
] as const;

describe("cross-fragment foreign keys", () => {
  it("points every tenant-scoped sibling table at tenants.id", () => {
    for (const { table, column } of TENANT_SCOPED_TABLES) {
      expectForeignKey(table, column, "tenants");
    }
  });

  it("points authored rows and conversation ownership at the auth user", () => {
    expectForeignKey(campaignVersions, "created_by", "user");
    expectForeignKey(styleProfileVersions, "created_by", "user");
    expectForeignKey(promptOverrideVersions, "created_by", "user");
    expectForeignKey(conversations, "owner_user_id", "user");
  });

  it("points the send ledger at provider accounts, prospects and campaigns", () => {
    expectForeignKey(actions, "account_id", "provider_accounts");
    expectForeignKey(actions, "prospect_id", "prospects");
    expectForeignKey(actions, "campaign_id", "campaigns");
    expectForeignKey(actions, "campaign_version_id", "campaign_versions");
    expectForeignKey(sendAttempts, "account_id", "provider_accounts");
    expectForeignKey(accountLeases, "account_id", "provider_accounts");
    expectForeignKey(quotaReservations, "account_id", "provider_accounts");
    expectForeignKey(quotaReservations, "campaign_id", "campaigns");
  });

  it("points optional usage references at provider accounts and actions", () => {
    expectForeignKey(usageEvents, "account_id", "provider_accounts");
    expectForeignKey(usageEvents, "action_id", "actions");
  });

  it("keeps a tenant foreign key on every listed sibling table", () => {
    expect(TENANT_SCOPED_TABLES).toHaveLength(26);
  });
});
