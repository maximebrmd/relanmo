import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { auditEvents, usageEvents } from "./audit";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("audit schema fragment", () => {
  it("names tables explicitly", () => {
    expect(getTableConfig(usageEvents).name).toBe("usage_events");
    expect(getTableConfig(auditEvents).name).toBe("audit_events");
  });

  it("distinguishes measured usage kinds, units and quantities", () => {
    expect(columnNames(usageEvents)).toEqual([
      "event_id",
      "tenant_id",
      "kind",
      "unit",
      "quantity",
      "measurement",
      "model",
      "prompt_version_id",
      "account_id",
      "action_id",
      "cost_minor_units",
      "created_at",
    ]);
    const config = getTableConfig(usageEvents);
    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "usage_events_kind_check",
        "usage_events_measurement_check",
        "usage_events_quantity_check",
      ])
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "usageEvents_tenantId_idx",
        "usageEvents_tenantId_kind_idx",
      ])
    );
  });

  it("reads back usage events independently of billing/audit tables", () => {
    expect(usageEvents.eventId.primary).toBe(true);
    expect(usageEvents.tenantId.notNull).toBe(true);
  });

  it("dedupes audit events per tenant by idempotency key and keeps details a bounded array", () => {
    const config = getTableConfig(auditEvents);
    expect(config.uniqueConstraints.map((unique) => unique.name)).toContain(
      "auditEvents_tenantId_idempotencyKey_key"
    );
    expect(config.checks.map((check) => check.name)).toContain(
      "audit_events_details_array_check"
    );
    expect(columnNames(auditEvents)).toEqual([
      "event_id",
      "tenant_id",
      "idempotency_key",
      "type",
      "entity_kind",
      "entity_id",
      "actor",
      "details",
      "created_at",
    ]);
  });

  it("never stores raw message text, tokens or provider secrets in usage or audit rows", () => {
    const columns = [...columnNames(usageEvents), ...columnNames(auditEvents)];
    for (const forbidden of [
      "message_text",
      "access_token",
      "refresh_token",
      "secret",
      "password",
      "credential",
    ]) {
      expect(columns.some((name) => name.includes(forbidden))).toBe(false);
    }
  });
});
