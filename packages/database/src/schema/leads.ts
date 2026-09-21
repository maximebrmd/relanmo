import type {
  AccountId,
  Attachment,
  ConversationId,
  EvidenceAssertion,
  EvidenceId,
  MessageId,
  ProspectId,
  TenantId,
  UserId,
} from "@relanmo/domain/contracts";
import {
  EVIDENCE_PROVENANCE,
  MESSAGE_ACTORS,
  MESSAGE_DIRECTIONS,
  MESSAGE_SOURCES,
  OWNERSHIP_KINDS,
  OWNERSHIP_REASONS,
  SUPPRESSION_REASONS,
} from "@relanmo/domain/contracts";
import { PROVIDER_ACCOUNT_STATUSES } from "@relanmo/domain/ports/persistence/accounts";
import { CONVERSATION_STATUSES } from "@relanmo/domain/ports/persistence/conversations";
import { PROSPECT_STATUSES } from "@relanmo/domain/ports/persistence/prospects";
import { relations, sql } from "drizzle-orm";
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

import { user } from "./auth";
import { tenants } from "./tenancy";

// Unipile-connected LinkedIn accounts (C3 provider_accounts). `providerAccountId` is
// globally unique, not scoped by tenant, so one provider account cannot be silently
// rebound to a second tenant.
export const providerAccounts = pgTable(
  "provider_accounts",
  {
    id: text("id").$type<AccountId>().primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    providerAccountId: text("provider_account_id").notNull().unique(),
    providerUserId: text("provider_user_id"),
    status: text("status", { enum: PROVIDER_ACCOUNT_STATUSES }).notNull(),
    healthReason: text("health_reason"),
    healthObservedAt: timestamp("health_observed_at", {
      withTimezone: true,
    }).notNull(),
    healthCapabilities: jsonb("health_capabilities")
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastSuccessfulReconciliationAt: timestamp(
      "last_successful_reconciliation_at",
      { withTimezone: true }
    ),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("provider_accounts_tenantId_idx").on(table.tenantId)]
);

// One row per provider profile within an account; identity collisions across accounts
// are resolved in application code (see @relanmo/domain identity matching), not merged here.
export const prospects = pgTable(
  "prospects",
  {
    id: text("id").$type<ProspectId>().primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .$type<AccountId>()
      .notNull()
      .references(() => providerAccounts.id, { onDelete: "restrict" }),
    providerProfileId: text("provider_profile_id").notNull(),
    legacyProviderMemberIds: jsonb("legacy_provider_member_ids")
      .$type<readonly string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    publicIdentifier: text("public_identifier"),
    displayName: text("display_name"),
    headline: text("headline"),
    company: text("company"),
    location: text("location"),
    profileUrl: text("profile_url"),
    status: text("status", { enum: PROSPECT_STATUSES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("prospects_account_providerProfileId_key").on(
      table.accountId,
      table.providerProfileId
    ),
    index("prospects_tenantId_idx").on(table.tenantId),
  ]
);

// Evidence grounds a qualification; no unsupported model claim becomes evidence just
// by being returned (C1). Deduped per prospect/source/claim so the same fact scraped
// twice does not multiply.
export const evidence = pgTable(
  "evidence",
  {
    id: text("id").$type<EvidenceId>().primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .$type<AccountId>()
      .references(() => providerAccounts.id, { onDelete: "set null" }),
    prospectId: text("prospect_id")
      .$type<ProspectId>()
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    provenance: text("provenance", { enum: EVIDENCE_PROVENANCE }).notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url"),
    normalizedClaim: text("normalized_claim").notNull(),
    assertions: jsonb("assertions")
      .$type<readonly EvidenceAssertion[]>()
      .notNull()
      .default([]),
    contentHash: text("content_hash"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("evidence_prospect_source_claim_key").on(
      table.prospectId,
      table.sourceId,
      table.normalizedClaim
    ),
    index("evidence_prospectId_idx").on(table.prospectId),
  ]
);

// One row per account/prospect pair (not per campaign): this is the reply-stop
// invariant from the outcome statement. `ownershipRevision` backs the optimistic
// compare-and-set used by pair ownership claims/reconciliation (C3 lock order).
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").$type<ConversationId>().primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .$type<AccountId>()
      .notNull()
      .references(() => providerAccounts.id, { onDelete: "restrict" }),
    prospectId: text("prospect_id")
      .$type<ProspectId>()
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    status: text("status", { enum: CONVERSATION_STATUSES }).notNull(),
    ownershipKind: text("ownership_kind", { enum: OWNERSHIP_KINDS }).notNull(),
    ownershipReason: text("ownership_reason", {
      enum: OWNERSHIP_REASONS,
    }).notNull(),
    ownerUserId: text("owner_user_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "set null" }),
    ownershipRecordedAt: timestamp("ownership_recorded_at", {
      withTimezone: true,
    }).notNull(),
    ownershipRevision: integer("ownership_revision").notNull().default(0),
    humanOwnedAt: timestamp("human_owned_at", { withTimezone: true }),
    lastIncomingAt: timestamp("last_incoming_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("conversations_account_prospect_key").on(
      table.accountId,
      table.prospectId
    ),
    check(
      "conversations_bot_eligible_has_no_owner_check",
      sql`${table.ownershipKind} <> 'BOT_ELIGIBLE' OR ${table.ownerUserId} IS NULL`
    ),
  ]
);

// `text` stays nullable and the check below only forbids a fully empty message, so an
// attachment-only reply (empty text, non-empty attachments) is representable.
export const messages = pgTable(
  "messages",
  {
    id: text("id").$type<MessageId>().primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .$type<AccountId>()
      .notNull()
      .references(() => providerAccounts.id, { onDelete: "restrict" }),
    prospectId: text("prospect_id")
      .$type<ProspectId>()
      .notNull()
      .references(() => prospects.id, { onDelete: "restrict" }),
    conversationId: text("conversation_id")
      .$type<ConversationId>()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: MESSAGE_DIRECTIONS }).notNull(),
    actor: text("actor", { enum: MESSAGE_ACTORS }).notNull(),
    source: text("source", { enum: MESSAGE_SOURCES }).notNull(),
    providerMessageId: text("provider_message_id"),
    dedupeKey: text("dedupe_key"),
    text: text("text"),
    attachments: jsonb("attachments")
      .$type<readonly Attachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Provider-reported occurrence time, kept separate from our own ingestion time so a
    // delayed webhook cannot be mistaken for a delayed prospect reply.
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("messages_account_providerMessageId_key").on(
      table.accountId,
      table.providerMessageId
    ),
    unique("messages_account_dedupeKey_key").on(
      table.accountId,
      table.dedupeKey
    ),
    index("messages_conversationId_idx").on(table.conversationId),
    check(
      "messages_text_or_attachment_check",
      sql`${table.text} IS NOT NULL OR jsonb_array_length(${table.attachments}) > 0`
    ),
  ]
);

// Durable, customer-specific exclusion, kept separate from Ownership (C1: suppression is
// never a member of Ownership) so a campaign restart cannot resurrect a suppressed pair.
export const suppressionEntries = pgTable(
  "suppression_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .$type<TenantId>()
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .$type<AccountId>()
      .notNull()
      .references(() => providerAccounts.id, { onDelete: "restrict" }),
    prospectId: text("prospect_id")
      .$type<ProspectId>()
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    reason: text("reason", { enum: SUPPRESSION_REASONS }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("suppression_entries_account_prospect_key").on(
      table.accountId,
      table.prospectId
    ),
  ]
);

export const providerAccountsRelations = relations(
  providerAccounts,
  ({ many, one }) => ({
    conversations: many(conversations),
    prospects: many(prospects),
    tenant: one(tenants, {
      fields: [providerAccounts.tenantId],
      references: [tenants.id],
    }),
  })
);

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  account: one(providerAccounts, {
    fields: [prospects.accountId],
    references: [providerAccounts.id],
  }),
  conversations: many(conversations),
  evidence: many(evidence),
  tenant: one(tenants, {
    fields: [prospects.tenantId],
    references: [tenants.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  account: one(providerAccounts, {
    fields: [evidence.accountId],
    references: [providerAccounts.id],
  }),
  prospect: one(prospects, {
    fields: [evidence.prospectId],
    references: [prospects.id],
  }),
  tenant: one(tenants, {
    fields: [evidence.tenantId],
    references: [tenants.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    account: one(providerAccounts, {
      fields: [conversations.accountId],
      references: [providerAccounts.id],
    }),
    messages: many(messages),
    ownerUser: one(user, {
      fields: [conversations.ownerUserId],
      references: [user.id],
    }),
    prospect: one(prospects, {
      fields: [conversations.prospectId],
      references: [prospects.id],
    }),
    tenant: one(tenants, {
      fields: [conversations.tenantId],
      references: [tenants.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  account: one(providerAccounts, {
    fields: [messages.accountId],
    references: [providerAccounts.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  prospect: one(prospects, {
    fields: [messages.prospectId],
    references: [prospects.id],
  }),
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
}));

export const suppressionEntriesRelations = relations(
  suppressionEntries,
  ({ one }) => ({
    account: one(providerAccounts, {
      fields: [suppressionEntries.accountId],
      references: [providerAccounts.id],
    }),
    prospect: one(prospects, {
      fields: [suppressionEntries.prospectId],
      references: [prospects.id],
    }),
    tenant: one(tenants, {
      fields: [suppressionEntries.tenantId],
      references: [tenants.id],
    }),
  })
);

/**
 * Cross-fragment foreign-key intent for P020 (packages/database/src/schema/ integration
 * owner). This fragment does not import the sibling schema files below; P020 adds the
 * real `.references()` once every fragment has merged.
 */
export const leadsExternalForeignKeyIntent = [
  {
    column: "provider_accounts.tenant_id",
    references: "tenants.id (P015 tenancy.ts)",
  },
  { column: "prospects.tenant_id", references: "tenants.id (P015 tenancy.ts)" },
  { column: "evidence.tenant_id", references: "tenants.id (P015 tenancy.ts)" },
  {
    column: "conversations.tenant_id",
    references: "tenants.id (P015 tenancy.ts)",
  },
  {
    column: "conversations.owner_user_id",
    references: "user.id (P014 auth.ts)",
  },
  { column: "messages.tenant_id", references: "tenants.id (P015 tenancy.ts)" },
  {
    column: "suppression_entries.tenant_id",
    references: "tenants.id (P015 tenancy.ts)",
  },
] as const;
