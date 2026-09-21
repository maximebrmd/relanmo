import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  billingCustomers,
  billingEntitlements,
  billingEvents,
  subscriptions,
} from "./billing";
import { expectTimezoneAwareInstants } from "./test-helpers";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("billing schema fragment", () => {
  it("names tables explicitly", () => {
    expect(getTableConfig(billingCustomers).name).toBe("billing_customers");
    expect(getTableConfig(subscriptions).name).toBe("subscriptions");
    expect(getTableConfig(billingEntitlements).name).toBe(
      "billing_entitlements"
    );
    expect(getTableConfig(billingEvents).name).toBe("billing_events");
  });

  it("stores every fragment instant as a timezone-aware timestamp", () => {
    expectTimezoneAwareInstants(billingCustomers, ["created_at", "updated_at"]);
    expectTimezoneAwareInstants(subscriptions, [
      "current_period_end",
      "updated_at",
    ]);
    expectTimezoneAwareInstants(billingEntitlements, [
      "effective_at",
      "valid_until",
      "updated_at",
    ]);
    expectTimezoneAwareInstants(billingEvents, [
      "occurred_at",
      "provider_event_created_at",
      "applied_at",
      "effective_at",
      "valid_until",
    ]);
  });

  it("uniquely maps a tenant to one provider customer", () => {
    expect(billingCustomers.tenantId.primary).toBe(true);
    expect(billingCustomers.providerCustomerId.isUnique).toBe(true);
    expect(columnNames(billingCustomers)).toEqual([
      "tenant_id",
      "provider_customer_id",
      "created_at",
      "updated_at",
    ]);
  });

  it("keeps subscription state constrained and tenant-indexed", () => {
    const config = getTableConfig(subscriptions);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "subscriptions_tenantId_idx"
    );
    const [stateCheck] = config.checks;
    expect(stateCheck.name).toBe("subscriptions_state_check");
    expect(subscriptions.providerSubscriptionId.primary).toBe(true);
  });

  it("keeps one durable entitlement decision per tenant with an explicit active flag", () => {
    expect(billingEntitlements.tenantId.primary).toBe(true);
    expect(columnNames(billingEntitlements)).toEqual([
      "tenant_id",
      "state",
      "active",
      "effective_at",
      "valid_until",
      "provider_subscription_id",
      "updated_at",
    ]);
    const config = getTableConfig(billingEntitlements);
    expect(config.checks.map((check) => check.name)).toContain(
      "billing_entitlements_state_check"
    );
  });

  it("dedupes billing events by provider event ID and keeps currency/amount explicit", () => {
    const config = getTableConfig(billingEvents);
    expect(config.uniqueConstraints.map((unique) => unique.name)).toContain(
      "billingEvents_providerEventId_key"
    );
    expect(columnNames(billingEvents)).toEqual(
      expect.arrayContaining([
        "provider_event_id",
        "occurred_at",
        "provider_event_created_at",
        "applied_at",
        "effective_at",
        "currency",
        "amount_minor_units",
      ])
    );
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "billing_events_state_check",
        "billing_events_currency_check",
      ])
    );
  });

  it("never stores a raw payment credential or provider secret", () => {
    const columns = [
      ...columnNames(billingCustomers),
      ...columnNames(subscriptions),
      ...columnNames(billingEntitlements),
      ...columnNames(billingEvents),
    ];
    for (const forbidden of ["token", "secret", "card", "password"]) {
      expect(columns.some((name) => name.includes(forbidden))).toBe(false);
    }
  });
});
