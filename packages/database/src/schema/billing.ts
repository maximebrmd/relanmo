import { ENTITLEMENT_STATES } from "@relanmo/domain/ports/persistence";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// `state` columns below are constrained to ENTITLEMENT_STATES, frozen by C3's
// BillingRepository port (packages/domain/src/ports/persistence/billing.ts). Keep both aligned.
const entitlementStateCheck = sql.join(
  ENTITLEMENT_STATES.map((state) => sql`${state}`),
  sql.raw(", ")
);

// Cross-fragment FK intent for P020 (packages/domain/src/ports/persistence/README.md):
// tenantId -> tenants.id on every table below. providerCustomerId/providerSubscriptionId/
// providerEventId are external Stripe identifiers and never gain a local foreign key.
export const billingCustomers = pgTable("billing_customers", {
  tenantId: text("tenant_id").primaryKey(),
  providerCustomerId: text("provider_customer_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    providerSubscriptionId: text("provider_subscription_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    state: text("state").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscriptions_tenantId_idx").on(table.tenantId),
    check(
      "subscriptions_state_check",
      sql`${table.state} in (${entitlementStateCheck})`
    ),
  ]
);

// One current entitlement decision per tenant; billing_events below records the ledger
// of provider events that moved it. Distinct from `subscriptions`, which mirrors Stripe's
// own subscription object rather than our access decision.
export const billingEntitlements = pgTable(
  "billing_entitlements",
  {
    tenantId: text("tenant_id").primaryKey(),
    state: text("state").notNull(),
    active: boolean("active").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    validUntil: timestamp("valid_until"),
    providerSubscriptionId: text("provider_subscription_id"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "billing_entitlements_state_check",
      sql`${table.state} in (${entitlementStateCheck})`
    ),
  ]
);

export const billingEvents = pgTable(
  "billing_events",
  {
    eventId: text("event_id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    providerEventCreatedAt: timestamp("provider_event_created_at").notNull(),
    appliedAt: timestamp("applied_at").defaultNow().notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    providerSubscriptionId: text("provider_subscription_id"),
    state: text("state").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    validUntil: timestamp("valid_until"),
    currency: text("currency"),
    amountMinorUnits: integer("amount_minor_units"),
  },
  (table) => [
    index("billingEvents_tenantId_idx").on(table.tenantId),
    unique("billingEvents_providerEventId_key").on(table.providerEventId),
    check(
      "billing_events_state_check",
      sql`${table.state} in (${entitlementStateCheck})`
    ),
    check(
      "billing_events_currency_check",
      sql`${table.currency} is null or ${table.currency} ~ '^[A-Z]{3}$'`
    ),
  ]
);
