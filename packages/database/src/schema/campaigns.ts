import type { BusinessWindowConfiguration } from "@relanmo/domain/contracts";
import { CAMPAIGN_STATUSES } from "@relanmo/domain/contracts/product";
import type {
  CampaignSequenceStep,
  CampaignTargeting,
} from "@relanmo/domain/contracts/product";
import type { SequenceClosureConfiguration } from "@relanmo/domain/ports/persistence/campaigns";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// External foreign-key intent for P020 (packages/database/src/schema/index.ts integration):
//   campaigns.tenant_id -> tenancy.tenants.id (P015)
//   campaign_versions.created_by -> auth.user.id
// This fragment compiles independently and does not import the unmerged tenancy schema.
export const campaignStatus = pgEnum("campaign_status", [...CAMPAIGN_STATUSES]);

// Mutable current-state row: identity, activation status and the two version pointers
// draft-version comparison and active-campaign history are built from.
export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    status: campaignStatus("status").notNull().default("DRAFT"),
    // Head of unactivated edits; diffed against activeVersionId for draft comparison.
    // No DB-level FK: campaignVersions is declared below and the reference would be
    // circular with campaignVersions.campaignId, which stays the enforced direction.
    draftVersionId: text("draft_version_id"),
    // The version currently authorizing the bounded automated sequence.
    activeVersionId: text("active_version_id"),
    outboundPaused: boolean("outbound_paused").notNull().default(false),
    pauseReason: text("pause_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("campaigns_tenantId_idx").on(table.tenantId),
    index("campaigns_draftVersionId_idx").on(table.draftVersionId),
    index("campaigns_activeVersionId_idx").on(table.activeVersionId),
  ]
);

// Immutable per-edit snapshot reconstructing the exact campaign inputs behind any draft
// or activated version. Never updated or deleted, so history of what authorized a send
// stays intact even after later edits.
export const campaignVersions = pgTable(
  "campaign_versions",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    revision: integer("revision").notNull(),
    name: text("name").notNull(),
    offer: text("offer").notNull(),
    icpDescription: text("icp_description").notNull(),
    dailyQuota: integer("daily_quota").notNull(),
    dailyInvitationQuota: integer("daily_invitation_quota").notNull(),
    dailyMessageQuota: integer("daily_message_quota").notNull(),
    exclusions: jsonb("exclusions").notNull().$type<readonly string[]>(),
    targeting: jsonb("targeting").notNull().$type<CampaignTargeting>(),
    sequence: jsonb("sequence")
      .notNull()
      .$type<readonly CampaignSequenceStep[]>(),
    sequenceClosure: jsonb("sequence_closure")
      .notNull()
      .$type<SequenceClosureConfiguration>(),
    businessWindow: jsonb("business_window")
      .notNull()
      .$type<BusinessWindowConfiguration>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: text("created_by").notNull(),
  },
  (table) => [
    uniqueIndex("campaignVersions_campaignId_revision_idx").on(
      table.campaignId,
      table.revision
    ),
    index("campaignVersions_tenantId_idx").on(table.tenantId),
  ]
);

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  versions: many(campaignVersions),
}));

export const campaignVersionsRelations = relations(
  campaignVersions,
  ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignVersions.campaignId],
      references: [campaigns.id],
    }),
  })
);
