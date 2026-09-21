import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  accountLeases,
  actionEvents,
  actions,
  deliveryExternalForeignKeyIntent,
  outboxEvents,
  quotaReservations,
  sendAttempts,
  sendReceipts,
  webhookEvents,
} from "./delivery";
import { expectTimezoneAwareInstants } from "./test-helpers";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

function uniqueNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).uniqueConstraints.map(
    (constraint) => constraint.name
  );
}

function indexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe("delivery ledger schema fragment", () => {
  it("names every table for the card's actions/attempts/leases/queues scope", () => {
    expect(getTableConfig(actions).name).toBe("actions");
    expect(getTableConfig(sendAttempts).name).toBe("send_attempts");
    expect(getTableConfig(sendReceipts).name).toBe("send_receipts");
    expect(getTableConfig(accountLeases).name).toBe("account_leases");
    expect(getTableConfig(quotaReservations).name).toBe("quota_reservations");
    expect(getTableConfig(webhookEvents).name).toBe("webhook_events");
    expect(getTableConfig(outboxEvents).name).toBe("outbox_events");
    expect(getTableConfig(actionEvents).name).toBe("action_events");
  });

  it("stores every fragment instant as a timezone-aware timestamp", () => {
    expectTimezoneAwareInstants(actions, [
      "created_at",
      "state_at",
      "lease_expires_at",
    ]);
    expectTimezoneAwareInstants(sendAttempts, [
      "authorized_at",
      "lease_expires_at",
    ]);
    expectTimezoneAwareInstants(sendReceipts, ["completed_at", "recorded_at"]);
    expectTimezoneAwareInstants(accountLeases, ["acquired_at", "expires_at"]);
    expectTimezoneAwareInstants(quotaReservations, [
      "period_start",
      "period_end",
      "created_at",
      "updated_at",
    ]);
    expectTimezoneAwareInstants(webhookEvents, [
      "lease_expires_at",
      "observed_at",
      "received_at",
      "available_at",
      "processed_at",
      "quarantined_at",
    ]);
    expectTimezoneAwareInstants(outboxEvents, [
      "lease_expires_at",
      "created_at",
      "available_at",
    ]);
    expectTimezoneAwareInstants(actionEvents, ["recorded_at"]);
  });

  it("gives actions an immutable identity plus its current lifecycle projection", () => {
    expect(columnNames(actions)).toEqual([
      "id",
      "tenant_id",
      "account_id",
      "prospect_id",
      "campaign_id",
      "campaign_version_id",
      "step",
      "payload",
      "evidence_ids",
      "source_versions",
      "created_at",
      "state",
      "state_at",
      "attempt_id",
      "lease_expires_at",
      "lease_fence",
      "provider_message_id",
      "failure_reason",
      "unknown_reason",
    ]);
  });

  it("scopes the action step key to tenant only, without campaignVersionId, so a campaign edit cannot revive a completed step", () => {
    const config = getTableConfig(actions);
    const stepKey = config.uniqueConstraints.find(
      (constraint) => constraint.name === "actions_step_key"
    );
    expect(stepKey).toBeDefined();
    expect(stepKey?.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "account_id",
      "campaign_id",
      "prospect_id",
      "step",
    ]);
    const identityIndex = config.indexes.find(
      (index) => index.config.name === "actions_identity_idx"
    );
    expect(
      identityIndex?.config.columns.map((column) =>
        "name" in column ? column.name : null
      )
    ).toContain("campaign_version_id");
  });

  it("keeps send attempts append-only and traceable back to the authorizing action", () => {
    expect(columnNames(sendAttempts)).toEqual(
      expect.arrayContaining([
        "id",
        "action_id",
        "account_id",
        "request_id",
        "fence",
        "worker_id",
        "quota_reservation_id",
        "lease_expires_at",
      ])
    );
    expect(uniqueNames(sendAttempts)).toContain("send_attempts_request_idx");
  });

  it("retains every send outcome, including UNKNOWN, distinguishable from a confirmed receipt", () => {
    expect(columnNames(sendReceipts)).toEqual(
      expect.arrayContaining([
        "id",
        "action_id",
        "attempt_id",
        "provider_message_id",
        "failure_reason",
        "unknown_reason",
        "completed_at",
        "recorded_at",
      ])
    );
    expect(uniqueNames(sendReceipts)).toContain("send_receipts_attempt_idx");
  });

  it("gives account leases a per-account fence so a second worker cannot claim the same account", () => {
    expect(columnNames(accountLeases)).toEqual([
      "id",
      "tenant_id",
      "account_id",
      "owner",
      "fence",
      "acquired_at",
      "expires_at",
    ]);
    expect(uniqueNames(accountLeases)).toContain("account_leases_account_idx");
  });

  it("scopes one quota reservation per action and bucket", () => {
    expect(uniqueNames(quotaReservations)).toContain(
      "quota_reservations_action_bucket_idx"
    );
    expect(indexNames(quotaReservations)).toContain(
      "quota_reservations_account_period_idx"
    );
  });

  it("scopes webhook dedupe keys per tenant and provider, and gives claimed rows a lease", () => {
    expect(columnNames(webhookEvents)).toEqual(
      expect.arrayContaining([
        "provider",
        "dedupe_key",
        "lease_worker_id",
        "lease_fence",
        "lease_expires_at",
        "processed_at",
        "quarantined_at",
      ])
    );
    const dedupe = getTableConfig(webhookEvents).uniqueConstraints.find(
      (constraint) => constraint.name === "webhook_events_dedupe_idx"
    );
    expect(dedupe?.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "provider",
      "dedupe_key",
    ]);
  });

  it("scopes outbox dedupe keys per tenant and gives claimed rows a lease", () => {
    expect(columnNames(outboxEvents)).toEqual(
      expect.arrayContaining([
        "dedupe_key",
        "lease_worker_id",
        "lease_fence",
        "lease_expires_at",
        "attempt",
        "last_error",
      ])
    );
    const dedupe = getTableConfig(outboxEvents).uniqueConstraints.find(
      (constraint) => constraint.name === "outbox_events_dedupe_idx"
    );
    expect(dedupe?.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "dedupe_key",
    ]);
  });

  it("keeps a lifecycle event per action, ordered for replay", () => {
    expect(columnNames(actionEvents)).toEqual([
      "id",
      "tenant_id",
      "action_id",
      "event",
      "recorded_at",
    ]);
    expect(indexNames(actionEvents)).toContain("action_events_action_idx");
  });

  it("lists every cross-fragment foreign-key intent for P020 to integrate", () => {
    expect(deliveryExternalForeignKeyIntent.length).toBeGreaterThan(0);
    const columns = deliveryExternalForeignKeyIntent.map(
      (entry) => entry.column
    );
    expect(columns).toContain("actions.account_id");
    expect(columns).toContain("actions.prospect_id");
    expect(columns).toContain("actions.campaign_id");
    expect(columns).toContain("actions.campaign_version_id");
    expect(columns).toContain("send_attempts.account_id");
    expect(columns).toContain("account_leases.account_id");
    expect(columns).toContain("quota_reservations.campaign_id");
    for (const entry of deliveryExternalForeignKeyIntent) {
      expect(entry.column.length).toBeGreaterThan(0);
      expect(entry.references.length).toBeGreaterThan(0);
    }
  });
});
