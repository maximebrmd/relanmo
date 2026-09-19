import { FRENCH_TONES, STYLE_SOURCES } from "@relanmo/domain/contracts/product";
import type { StyleStepOverride } from "@relanmo/domain/contracts/product";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { campaigns } from "./campaigns";

// External foreign-key intent for P020 (packages/database/src/schema/index.ts integration):
//   style_profiles.tenant_id -> tenancy.tenants.id (P015)
//   style_profile_versions.created_by -> auth.user.id (nullable)
//   prompt_override_versions.created_by -> auth.user.id (nullable)
// This fragment compiles independently and does not import the unmerged tenancy schema.
// campaigns is a same-task fragment (also owned by P016), not a sibling import.
export const styleSource = pgEnum("style_source", [...STYLE_SOURCES]);
export const frenchTone = pgEnum("french_tone", [...FRENCH_TONES]);

const STYLE_PROFILE_VERSION_KINDS = [
  "STYLE_EXPLICIT",
  "STYLE_INFERRED",
] as const;
export const styleProfileVersionKind = pgEnum(
  "style_profile_version_kind",
  STYLE_PROFILE_VERSION_KINDS
);

// One row per tenant: the current writing-style pointers. `source` names which pointer
// currently drafts with; never shared across tenants (tenant_id is unique).
export const styleProfiles = pgTable(
  "style_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().unique(),
    source: styleSource("source").notNull().default("DEFAULT"),
    // No DB-level FK on these three pointers: styleProfileVersions is declared below and
    // the reference would be circular with styleProfileVersions.styleProfileId, which
    // stays the enforced direction.
    explicitVersionId: text("explicit_version_id"),
    acceptedInferredVersionId: text("accepted_inferred_version_id"),
    // Set when a bounded inference produced a proposal the customer has not accepted yet.
    suggestedInferredVersionId: text("suggested_inferred_version_id"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("styleProfiles_explicitVersionId_idx").on(table.explicitVersionId),
    index("styleProfiles_acceptedInferredVersionId_idx").on(
      table.acceptedInferredVersionId
    ),
  ]
);

// Immutable per-save snapshot. STYLE_INFERRED rows carry evidenceIds so an accepted
// suggestion's provenance survives even after later customer edits.
export const styleProfileVersions = pgTable(
  "style_profile_versions",
  {
    id: text("id").primaryKey(),
    styleProfileId: text("style_profile_id")
      .notNull()
      .references(() => styleProfiles.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    kind: styleProfileVersionKind("kind").notNull(),
    tone: frenchTone("tone").notNull(),
    instructions: text("instructions"),
    examples: jsonb("examples").notNull().$type<readonly string[]>(),
    // Evidence backing a STYLE_INFERRED suggestion; empty for STYLE_EXPLICIT rows.
    evidenceIds: jsonb("evidence_ids")
      .notNull()
      .$type<readonly string[]>()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("styleProfileVersions_styleProfileId_idx").on(table.styleProfileId),
    index("styleProfileVersions_tenantId_idx").on(table.tenantId),
  ]
);

// Campaign-scoped DM-step template overrides, applied ahead of the tenant-wide style
// profile per prompt-personalization.md's precedence order. One row per campaign.
export const promptOverrides = pgTable(
  "prompt_overrides",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    campaignId: text("campaign_id")
      .notNull()
      .unique()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // No DB-level FK: promptOverrideVersions is declared below and the reference would
    // be circular with its promptOverrideId, which stays the enforced direction.
    activeVersionId: text("active_version_id"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("promptOverrides_tenantId_idx").on(table.tenantId)]
);

// Immutable per-save snapshot of step overrides, reconstructing the exact template text
// an existing draft was composed against.
export const promptOverrideVersions = pgTable(
  "prompt_override_versions",
  {
    id: text("id").primaryKey(),
    promptOverrideId: text("prompt_override_id")
      .notNull()
      .references(() => promptOverrides.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    stepOverrides: jsonb("step_overrides")
      .notNull()
      .$type<readonly StyleStepOverride[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("promptOverrideVersions_promptOverrideId_idx").on(
      table.promptOverrideId
    ),
  ]
);

export const styleProfilesRelations = relations(styleProfiles, ({ many }) => ({
  versions: many(styleProfileVersions),
}));

export const styleProfileVersionsRelations = relations(
  styleProfileVersions,
  ({ one }) => ({
    styleProfile: one(styleProfiles, {
      fields: [styleProfileVersions.styleProfileId],
      references: [styleProfiles.id],
    }),
  })
);

export const promptOverridesRelations = relations(
  promptOverrides,
  ({ many, one }) => ({
    campaign: one(campaigns, {
      fields: [promptOverrides.campaignId],
      references: [campaigns.id],
    }),
    versions: many(promptOverrideVersions),
  })
);

export const promptOverrideVersionsRelations = relations(
  promptOverrideVersions,
  ({ one }) => ({
    promptOverride: one(promptOverrides, {
      fields: [promptOverrideVersions.promptOverrideId],
      references: [promptOverrides.id],
    }),
  })
);
