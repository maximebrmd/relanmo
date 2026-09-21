import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  TENANT_STATUSES,
} from "@relanmo/domain/ports/persistence";
import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";

import { user } from "./auth";

// C3 (packages/domain/src/ports/persistence/tenancy.ts) is authoritative for
// these shapes. `tenants`/`memberships` back TenantRecord/MembershipRecord
// directly. `freelancer_profiles` backs ProfileVersionRecord: rows are
// append-only, and `is_current` marks the single row each tenant's current
// pointer resolves to, guarded by `saveRevision`'s optimistic check.
export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "tenants_status_check",
      sql`${table.status} in ${TENANT_STATUSES}`.inlineParams()
    ),
  ]
);

// No `onDelete` on `tenantId`: closing a tenant is a status change (see
// TENANT_STATUSES), not a row delete, so membership rows must not silently
// cascade away.
export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Prevents duplicate membership: one row per (tenant, user) ever, with
    // role/status transitions tracked by updating that same row.
    unique("memberships_tenant_user_unique").on(table.tenantId, table.userId),
    index("memberships_user_id_idx").on(table.userId),
    check(
      "memberships_role_check",
      sql`${table.role} in ${MEMBERSHIP_ROLES}`.inlineParams()
    ),
    check(
      "memberships_status_check",
      sql`${table.status} in ${MEMBERSHIP_STATUSES}`.inlineParams()
    ),
  ]
);

// Offer/target-market/geography facts mirror the C3 `ProfileFacts` shape.
// `targetMarket` has no counterpart in that persistence contract today even
// though the C4 product contract (contracts/product/profile.ts) carries it;
// stored here anyway so P049's onboarding command has a durable column to
// write to, and flagged in the P015 handoff for contract reconciliation.
// No LinkedIn/Unipile credential or account field belongs on this table:
// those stay in `provider_accounts`, owned by a different fragment.
export const freelancerProfiles = pgTable(
  "freelancer_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    revision: integer("revision").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    offer: text("offer"),
    targetMarket: text("target_market"),
    geography: jsonb("geography")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    skills: jsonb("skills").$type<readonly string[]>().notNull().default([]),
    exclusions: jsonb("exclusions")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    writingSamples: jsonb("writing_samples")
      .$type<readonly string[]>()
      .notNull()
      .default([]),
    availability: text("availability"),
    dayRateCents: integer("day_rate_cents"),
    preferredFrenchTone: text("preferred_french_tone"),
  },
  (table) => [
    // At most one current revision per tenant; `saveRevision` flips the old
    // current row false and inserts the new one inside the same transaction.
    uniqueIndex("freelancer_profiles_current_unique")
      .on(table.tenantId)
      .where(sql`${table.isCurrent} = true`.inlineParams()),
    unique("freelancer_profiles_tenant_revision_unique").on(
      table.tenantId,
      table.revision
    ),
    check(
      "freelancer_profiles_revision_check",
      sql`${table.revision} >= 0`.inlineParams()
    ),
    check(
      "freelancer_profiles_day_rate_check",
      sql`${table.dayRateCents} is null or ${table.dayRateCents} >= 0`.inlineParams()
    ),
  ]
);

export const tenantsRelations = relations(tenants, ({ many }) => ({
  memberships: many(memberships),
  profiles: many(freelancerProfiles),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
  user: one(user, {
    fields: [memberships.userId],
    references: [user.id],
  }),
}));

export const freelancerProfilesRelations = relations(
  freelancerProfiles,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [freelancerProfiles.tenantId],
      references: [tenants.id],
    }),
    createdByUser: one(user, {
      fields: [freelancerProfiles.createdBy],
      references: [user.id],
    }),
  })
);

/**
 * Tenant-scoped tables owned by sibling fragments (P016-P019) and the
 * cross-fragment CurrentVersionSet pointers (campaign/style/prompt/model)
 * inside TenantRecord.currentVersions all need `tenant_id -> tenants.id`.
 * This task cannot import those unmerged schemas; P020 adds the actual
 * `.references()` once every fragment listed in AGENTS.md/contracts.md C3
 * has merged.
 */
export const TENANCY_EXTERNAL_FOREIGN_KEY_INTENT = [
  { column: "provider_accounts.tenant_id", referencesTable: "tenants.id" },
  { column: "campaigns.tenant_id", referencesTable: "tenants.id" },
  {
    column: "campaign_versions.tenant_id",
    referencesTable: "tenants.id",
  },
  { column: "style_profiles.tenant_id", referencesTable: "tenants.id" },
  { column: "prospects.tenant_id", referencesTable: "tenants.id" },
  { column: "evidence.tenant_id", referencesTable: "tenants.id" },
  { column: "conversations.tenant_id", referencesTable: "tenants.id" },
  {
    column: "suppression_entries.tenant_id",
    referencesTable: "tenants.id",
  },
  { column: "actions.tenant_id", referencesTable: "tenants.id" },
  { column: "send_attempts.tenant_id", referencesTable: "tenants.id" },
  { column: "account_leases.tenant_id", referencesTable: "tenants.id" },
  { column: "quota_reservations.tenant_id", referencesTable: "tenants.id" },
  { column: "webhook_events.tenant_id", referencesTable: "tenants.id" },
  { column: "outbox_events.tenant_id", referencesTable: "tenants.id" },
  {
    column: "billing_customers.tenant_id",
    referencesTable: "tenants.id",
  },
  { column: "subscriptions.tenant_id", referencesTable: "tenants.id" },
  { column: "billing_events.tenant_id", referencesTable: "tenants.id" },
  { column: "usage_events.tenant_id", referencesTable: "tenants.id" },
  { column: "audit_events.tenant_id", referencesTable: "tenants.id" },
] as const;
