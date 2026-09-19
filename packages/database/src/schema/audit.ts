import { USAGE_KINDS } from "@relanmo/domain/ports/persistence";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// `kind` is constrained to USAGE_KINDS, frozen by C3's UsageRepository port
// (packages/domain/src/ports/persistence/billing.ts). Keep both aligned. `.inlineParams()`
// matches P015's tenancy.ts and renders literal SQL, since bind placeholders are not valid
// inside a CHECK clause.

// Cross-fragment FK intent for P020 (packages/domain/src/ports/persistence/README.md):
// tenantId -> tenants.id; accountId -> provider_accounts.id; actionId -> actions.id on
// usage_events. audit_events.entityId is a polymorphic reference (see entityKind) that
// P020 does not turn into a single foreign key.
export const usageEvents = pgTable(
  "usage_events",
  {
    eventId: text("event_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    kind: text("kind").notNull(),
    unit: text("unit").notNull(),
    quantity: integer("quantity").notNull(),
    measurement: text("measurement").notNull(),
    model: text("model"),
    promptVersionId: text("prompt_version_id"),
    accountId: text("account_id"),
    actionId: text("action_id"),
    costMinorUnits: integer("cost_minor_units"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("usageEvents_tenantId_idx").on(table.tenantId),
    index("usageEvents_tenantId_kind_idx").on(table.tenantId, table.kind),
    check(
      "usage_events_kind_check",
      sql`${table.kind} in ${USAGE_KINDS}`.inlineParams()
    ),
    check(
      "usage_events_measurement_check",
      sql`${table.measurement} in ('ACTUAL', 'ESTIMATED')`
    ),
    check("usage_events_quantity_check", sql`${table.quantity} >= 0`),
  ]
);

// `details` never carries provider secrets, raw credentials or full message text; it is a
// bounded key/value list of operator-decision facts (matching AuditField in the C3 port).
export const auditEvents = pgTable(
  "audit_events",
  {
    eventId: text("event_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    type: text("type").notNull(),
    entityKind: text("entity_kind").notNull(),
    entityId: text("entity_id").notNull(),
    actor: jsonb("actor"),
    details: jsonb("details").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("auditEvents_tenantId_idx").on(table.tenantId),
    index("auditEvents_tenantId_entity_idx").on(
      table.tenantId,
      table.entityKind,
      table.entityId
    ),
    unique("auditEvents_tenantId_idempotencyKey_key").on(
      table.tenantId,
      table.idempotencyKey
    ),
    // Non-blocking review note: this now also checks each entry is a {key, value} shaped
    // object (matching AuditField), not just that details is an array. No size bound is
    // added; C3 does not specify one, so that stays a follow-up.
    check(
      "audit_events_details_array_check",
      sql`jsonb_typeof(${table.details}) = 'array' and not exists (
        select 1 from jsonb_array_elements(${table.details}) as element
        where jsonb_typeof(element) <> 'object' or not (element ? 'key')
      )`
    ),
  ]
);
