import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  conversations,
  evidence,
  leadsExternalForeignKeyIntent,
  messages,
  prospects,
  providerAccounts,
  suppressionEntries,
} from "./leads";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

function uniqueColumnSets(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).uniqueConstraints.map((constraint) =>
    constraint.columns.map((column) => column.name)
  );
}

describe("leads schema fragment", () => {
  it("names every table distinctly", () => {
    expect(getTableConfig(providerAccounts).name).toBe("provider_accounts");
    expect(getTableConfig(prospects).name).toBe("prospects");
    expect(getTableConfig(evidence).name).toBe("evidence");
    expect(getTableConfig(conversations).name).toBe("conversations");
    expect(getTableConfig(messages).name).toBe("messages");
    expect(getTableConfig(suppressionEntries).name).toBe("suppression_entries");
  });

  it("keeps a provider account globally unique so it cannot be rebound across tenants", () => {
    expect(providerAccounts.providerAccountId.isUnique).toBe(true);
  });

  it("stores every fragment instant as a timezone-aware timestamp", () => {
    const expectedInstants = [
      {
        table: providerAccounts,
        columns: [
          "health_observed_at",
          "last_successful_reconciliation_at",
          "created_at",
          "updated_at",
        ],
      },
      { table: prospects, columns: ["created_at", "updated_at"] },
      { table: evidence, columns: ["captured_at", "created_at"] },
      {
        table: conversations,
        columns: [
          "ownership_recorded_at",
          "human_owned_at",
          "last_incoming_at",
          "last_message_at",
          "created_at",
          "updated_at",
        ],
      },
      {
        table: messages,
        columns: ["occurred_at", "received_at", "recorded_at"],
      },
      { table: suppressionEntries, columns: ["recorded_at"] },
    ] as const;

    for (const { table, columns } of expectedInstants) {
      const instants = getTableConfig(table).columns.filter((column) =>
        column.getSQLType().startsWith("timestamp")
      );
      expect(new Set(instants.map((column) => column.name))).toEqual(
        new Set(columns)
      );
      for (const column of instants) {
        expect(column.getSQLType()).toBe("timestamp with time zone");
      }
    }
  });

  it("scopes a conversation to exactly one account/prospect pair, independent of campaign", () => {
    expect(uniqueColumnSets(conversations)).toContainEqual([
      "account_id",
      "prospect_id",
    ]);
    expect(columnNames(conversations)).toEqual(
      expect.arrayContaining([
        "ownership_kind",
        "ownership_reason",
        "owner_user_id",
        "ownership_revision",
      ])
    );
    expect(columnNames(conversations)).not.toContain("campaign_id");
  });

  it("keeps a bot-eligible pair from carrying a human owner", () => {
    const config = getTableConfig(conversations);
    const names = config.checks.map((check) => check.name);
    expect(names).toContain("conversations_bot_eligible_has_no_owner_check");
  });

  it("lets a message carry no text as long as it has an attachment", () => {
    expect(messages.text.notNull).toBe(false);
    const config = getTableConfig(messages);
    expect(config.checks.map((check) => check.name)).toContain(
      "messages_text_or_attachment_check"
    );
  });

  it("dedupes messages per account by provider ID and by dedupe key", () => {
    expect(uniqueColumnSets(messages)).toContainEqual([
      "account_id",
      "provider_message_id",
    ]);
    expect(uniqueColumnSets(messages)).toContainEqual([
      "account_id",
      "dedupe_key",
    ]);
  });

  it("links every message to the conversation and prospect it belongs to", () => {
    const config = getTableConfig(messages);
    const referencedTables = config.foreignKeys.map(
      (foreignKey) => foreignKey.reference().foreignTable
    );
    expect(referencedTables).toContainEqual(conversations);
    expect(referencedTables).toContainEqual(prospects);
  });

  it("traces evidence to the prospect it grounds and dedupes by claim", () => {
    expect(columnNames(evidence)).toEqual(
      expect.arrayContaining([
        "prospect_id",
        "source_id",
        "normalized_claim",
        "assertions",
      ])
    );
    const config = getTableConfig(evidence);
    expect(
      config.foreignKeys.map(
        (foreignKey) => foreignKey.reference().foreignTable
      )
    ).toContainEqual(prospects);
    expect(uniqueColumnSets(evidence)).toContainEqual([
      "prospect_id",
      "source_id",
      "normalized_claim",
    ]);
  });

  it("prevents a duplicate provider profile from being upserted onto the same account", () => {
    expect(uniqueColumnSets(prospects)).toContainEqual([
      "account_id",
      "provider_profile_id",
    ]);
  });

  it("keeps suppression a separate durable exclusion, idempotent per pair", () => {
    expect(uniqueColumnSets(suppressionEntries)).toContainEqual([
      "account_id",
      "prospect_id",
    ]);
    expect(columnNames(suppressionEntries)).not.toContain("ownership_kind");
  });

  it("lists external foreign-key intent for P020 instead of importing sibling schema", () => {
    const columns = leadsExternalForeignKeyIntent.map((entry) => entry.column);
    expect(columns).toContain("provider_accounts.tenant_id");
    expect(columns).toContain("conversations.owner_user_id");
    for (const entry of leadsExternalForeignKeyIntent) {
      expect(entry.references.length).toBeGreaterThan(0);
    }
  });
});
