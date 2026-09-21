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
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { tenants } from "./tenancy";

export const campaignStatus = pgEnum("campaign_status", [...CAMPAIGN_STATUSES]);

// Mutable current-state row: identity, activation status and the two version pointers
// draft-version comparison and active-campaign history are built from.
export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: campaignStatus("status").notNull().default("DRAFT"),
    // Head of unactivated edits; diffed against activeVersionId for draft comparison.
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
    foreignKey({
      columns: [table.draftVersionId, table.id],
      foreignColumns: [campaignVersions.id, campaignVersions.campaignId],
      name: "campaigns_draftVersion_owner_fk",
    }),
    foreignKey({
      columns: [table.activeVersionId, table.id],
      foreignColumns: [campaignVersions.id, campaignVersions.campaignId],
      name: "campaigns_activeVersion_owner_fk",
    }),
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
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
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
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
  },
  (table) => [
    unique("campaignVersions_id_campaignId_unique").on(
      table.id,
      table.campaignId
    ),
    uniqueIndex("campaignVersions_campaignId_revision_idx").on(
      table.campaignId,
      table.revision
    ),
    index("campaignVersions_tenantId_idx").on(table.tenantId),
  ]
);

export const campaignsRelations = relations(campaigns, ({ many, one }) => ({
  activeVersion: one(campaignVersions, {
    fields: [campaigns.activeVersionId, campaigns.id],
    references: [campaignVersions.id, campaignVersions.campaignId],
    relationName: "campaignActiveVersion",
  }),
  draftVersion: one(campaignVersions, {
    fields: [campaigns.draftVersionId, campaigns.id],
    references: [campaignVersions.id, campaignVersions.campaignId],
    relationName: "campaignDraftVersion",
  }),
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  versions: many(campaignVersions, {
    relationName: "campaignOwnedVersions",
  }),
}));

export const campaignVersionsRelations = relations(
  campaignVersions,
  ({ many, one }) => ({
    activeForCampaigns: many(campaigns, {
      relationName: "campaignActiveVersion",
    }),
    campaign: one(campaigns, {
      fields: [campaignVersions.campaignId],
      references: [campaigns.id],
      relationName: "campaignOwnedVersions",
    }),
    createdByUser: one(user, {
      fields: [campaignVersions.createdBy],
      references: [user.id],
    }),
    draftForCampaigns: many(campaigns, {
      relationName: "campaignDraftVersion",
    }),
    tenant: one(tenants, {
      fields: [campaignVersions.tenantId],
      references: [tenants.id],
    }),
  })
);
