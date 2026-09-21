CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."action_failure_reason" AS ENUM('DEFINITIVE_PROVIDER_REFUSAL', 'INVALID_RECIPIENT', 'ACCOUNT_UNAVAILABLE', 'CAMPAIGN_PAUSED', 'QUOTA_UNAVAILABLE', 'VALIDATION_FAILED');--> statement-breakpoint
CREATE TYPE "public"."action_state" AS ENUM('READY', 'IN_FLIGHT', 'CONFIRMED', 'FAILED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."action_unknown_reason" AS ENUM('TIMEOUT', 'LEASE_EXPIRED', 'TRANSPORT_ERROR', 'RECONCILIATION_INCONCLUSIVE');--> statement-breakpoint
CREATE TYPE "public"."inbox_event_kind" AS ENUM('INCOMING_MESSAGE', 'OUTGOING_MESSAGE', 'UNRECOGNIZED');--> statement-breakpoint
CREATE TYPE "public"."inbox_event_state" AS ENUM('RECEIVED', 'LEASED', 'PROCESSED', 'QUARANTINED');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_kind" AS ENUM('START_WORKFLOW', 'STOP_WORKFLOW', 'PAUSE_WORKFLOW', 'NOTIFY_CUSTOMER');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_state" AS ENUM('PENDING', 'LEASED', 'DELIVERED', 'QUARANTINED');--> statement-breakpoint
CREATE TYPE "public"."quota_bucket" AS ENUM('INVITATIONS', 'MESSAGES');--> statement-breakpoint
CREATE TYPE "public"."quota_reservation_state" AS ENUM('HELD', 'CONSUMED', 'RELEASED', 'RETAINED_UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."french_tone" AS ENUM('DIRECT', 'WARM', 'FORMAL', 'CONVERSATIONAL', 'CONCISE');--> statement-breakpoint
CREATE TYPE "public"."style_formality" AS ENUM('CASUAL', 'NEUTRAL', 'FORMAL');--> statement-breakpoint
CREATE TYPE "public"."style_profile_version_kind" AS ENUM('STYLE_EXPLICIT', 'STYLE_INFERRED');--> statement-breakpoint
CREATE TYPE "public"."style_source" AS ENUM('DEFAULT', 'EXPLICIT', 'INFERRED_ACCEPTED');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"type" text NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor" jsonb,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auditEvents_tenantId_idempotencyKey_key" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "audit_events_details_array_check" CHECK (jsonb_typeof("audit_events"."details") = 'array' and not jsonb_path_exists("audit_events"."details", '$[*] ? (@.type() != "object" || !exists(@.key))'))
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"measurement" text NOT NULL,
	"model" text,
	"prompt_version_id" text,
	"account_id" text,
	"action_id" text,
	"cost_minor_units" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_kind_check" CHECK ("usage_events"."kind" in ('MODEL_INPUT_TOKENS', 'MODEL_OUTPUT_TOKENS', 'MODEL_REQUEST', 'OUTBOUND_ACTION', 'PROVIDER_REQUEST')),
	CONSTRAINT "usage_events_measurement_check" CHECK ("usage_events"."measurement" in ('ACTUAL', 'ESTIMATED')),
	CONSTRAINT "usage_events_quantity_check" CHECK ("usage_events"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "login_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_provider_customer_id_unique" UNIQUE("provider_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_entitlements" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"active" boolean NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"provider_subscription_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_entitlements_state_check" CHECK ("billing_entitlements"."state" in ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED', 'UNMAPPED'))
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"provider_event_created_at" timestamp with time zone NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_customer_id" text NOT NULL,
	"provider_subscription_id" text,
	"state" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone,
	"currency" text,
	"amount_minor_units" integer,
	CONSTRAINT "billingEvents_providerEventId_key" UNIQUE("provider_event_id"),
	CONSTRAINT "billing_events_state_check" CHECK ("billing_events"."state" in ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED', 'UNMAPPED')),
	CONSTRAINT "billing_events_currency_check" CHECK ("billing_events"."currency" is null or "billing_events"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "billing_events_currency_amount_pair_check" CHECK (("billing_events"."currency" is null) = ("billing_events"."amount_minor_units" is null))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"provider_subscription_id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"state" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_state_check" CHECK ("subscriptions"."state" in ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED', 'UNMAPPED'))
);
--> statement-breakpoint
CREATE TABLE "campaign_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"revision" integer NOT NULL,
	"name" text NOT NULL,
	"offer" text NOT NULL,
	"icp_description" text NOT NULL,
	"daily_quota" integer NOT NULL,
	"daily_invitation_quota" integer NOT NULL,
	"daily_message_quota" integer NOT NULL,
	"exclusions" jsonb NOT NULL,
	"targeting" jsonb NOT NULL,
	"sequence" jsonb NOT NULL,
	"sequence_closure" jsonb NOT NULL,
	"business_window" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "campaignVersions_id_campaignId_unique" UNIQUE("id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"draft_version_id" text,
	"active_version_id" text,
	"outbound_paused" boolean DEFAULT false NOT NULL,
	"pause_reason" text,
	"paused_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_leases" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"owner" text NOT NULL,
	"fence" integer NOT NULL,
	"acquired_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_leases_account_idx" UNIQUE("tenant_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "action_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"action_id" text NOT NULL,
	"event" jsonb NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"prospect_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_version_id" text NOT NULL,
	"step" text NOT NULL,
	"payload" jsonb NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"source_versions" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"state" "action_state" NOT NULL,
	"state_at" timestamp with time zone NOT NULL,
	"attempt_id" text,
	"lease_expires_at" timestamp with time zone,
	"lease_fence" integer,
	"provider_message_id" text,
	"failure_reason" "action_failure_reason",
	"unknown_reason" "action_unknown_reason",
	CONSTRAINT "actions_step_key" UNIQUE("tenant_id","account_id","campaign_id","prospect_id","step")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" "outbox_event_kind" NOT NULL,
	"state" "outbox_event_state" NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt" integer NOT NULL,
	"last_error" text,
	"lease_worker_id" text,
	"lease_fence" integer,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	CONSTRAINT "outbox_events_dedupe_idx" UNIQUE("tenant_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "quota_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"action_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"bucket" "quota_bucket" NOT NULL,
	"state" "quota_reservation_state" NOT NULL,
	"units" integer NOT NULL,
	"fence" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quota_reservations_action_bucket_idx" UNIQUE("action_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "send_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"action_id" text NOT NULL,
	"account_id" text NOT NULL,
	"request_id" text NOT NULL,
	"fence" integer NOT NULL,
	"worker_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"source_versions" jsonb NOT NULL,
	"quota_reservation_id" text NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "send_attempts_request_idx" UNIQUE("tenant_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "send_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"action_id" text NOT NULL,
	"attempt_id" text NOT NULL,
	"provider_message_id" text,
	"failure_reason" "action_failure_reason",
	"unknown_reason" "action_unknown_reason",
	"completed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "send_receipts_attempt_idx" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"kind" "inbox_event_kind" NOT NULL,
	"state" "inbox_event_state" NOT NULL,
	"scope" jsonb NOT NULL,
	"envelope" jsonb NOT NULL,
	"provider_event_id" text,
	"attempt" integer NOT NULL,
	"last_error" text,
	"lease_worker_id" text,
	"lease_fence" integer,
	"lease_expires_at" timestamp with time zone,
	"observed_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"quarantined_at" timestamp with time zone,
	CONSTRAINT "webhook_events_dedupe_idx" UNIQUE("tenant_id","provider","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"prospect_id" text NOT NULL,
	"status" text NOT NULL,
	"ownership_kind" text NOT NULL,
	"ownership_reason" text NOT NULL,
	"owner_user_id" text,
	"ownership_recorded_at" timestamp with time zone NOT NULL,
	"ownership_revision" integer DEFAULT 0 NOT NULL,
	"human_owned_at" timestamp with time zone,
	"last_incoming_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_account_prospect_key" UNIQUE("account_id","prospect_id"),
	CONSTRAINT "conversations_bot_eligible_has_no_owner_check" CHECK ("conversations"."ownership_kind" <> 'BOT_ELIGIBLE' OR "conversations"."owner_user_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text,
	"prospect_id" text NOT NULL,
	"provenance" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text,
	"normalized_claim" text NOT NULL,
	"content_hash" text,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_prospect_source_claim_key" UNIQUE("prospect_id","source_id","normalized_claim")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"prospect_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"direction" text NOT NULL,
	"actor" text NOT NULL,
	"source" text NOT NULL,
	"provider_message_id" text,
	"dedupe_key" text,
	"text" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_account_providerMessageId_key" UNIQUE("account_id","provider_message_id"),
	CONSTRAINT "messages_account_dedupeKey_key" UNIQUE("account_id","dedupe_key"),
	CONSTRAINT "messages_text_or_attachment_check" CHECK ("messages"."text" IS NOT NULL OR jsonb_array_length("messages"."attachments") > 0)
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_profile_id" text NOT NULL,
	"legacy_provider_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_identifier" text,
	"display_name" text,
	"headline" text,
	"company" text,
	"location" text,
	"profile_url" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospects_account_providerProfileId_key" UNIQUE("account_id","provider_profile_id")
);
--> statement-breakpoint
CREATE TABLE "provider_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_user_id" text,
	"status" text NOT NULL,
	"health_reason" text,
	"health_observed_at" timestamp with time zone NOT NULL,
	"health_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_successful_reconciliation_at" timestamp with time zone,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_accounts_provider_account_id_unique" UNIQUE("provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "suppression_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text NOT NULL,
	"prospect_id" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "suppression_entries_account_prospect_key" UNIQUE("account_id","prospect_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_override_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_override_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"revision" integer NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "promptOverrideVersions_id_promptOverrideId_unique" UNIQUE("id","prompt_override_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"active_version_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_overrides_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "style_profile_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"style_profile_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" "style_profile_version_kind" NOT NULL,
	"revision" integer NOT NULL,
	"tone" "french_tone",
	"formality" "style_formality",
	"greeting" text,
	"closing" text,
	"max_characters" integer,
	"forbidden_phrases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real,
	"model" text,
	"instructions" text,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "styleProfileVersions_id_styleProfileId_unique" UNIQUE("id","style_profile_id"),
	CONSTRAINT "styleProfileVersions_explicitRequirements_check" CHECK ("style_profile_versions"."kind" <> 'STYLE_EXPLICIT' OR ("style_profile_versions"."created_by" IS NOT NULL AND "style_profile_versions"."formality" IS NOT NULL AND "style_profile_versions"."tone" IS NOT NULL)),
	CONSTRAINT "styleProfileVersions_inferredModel_check" CHECK ("style_profile_versions"."kind" <> 'STYLE_INFERRED' OR "style_profile_versions"."model" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "style_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"source" "style_source" DEFAULT 'DEFAULT' NOT NULL,
	"explicit_version_id" text,
	"accepted_inferred_version_id" text,
	"suggested_inferred_version_id" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "style_profiles_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "freelancer_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"revision" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"offer" text,
	"target_market" text,
	"geography" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"writing_samples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability" text,
	"day_rate_cents" integer,
	"preferred_french_tone" text,
	CONSTRAINT "freelancer_profiles_tenant_revision_unique" UNIQUE("tenant_id","revision"),
	CONSTRAINT "freelancer_profiles_revision_check" CHECK ("freelancer_profiles"."revision" >= 0),
	CONSTRAINT "freelancer_profiles_day_rate_check" CHECK ("freelancer_profiles"."day_rate_cents" is null or "freelancer_profiles"."day_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_tenant_user_unique" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "memberships_role_check" CHECK ("memberships"."role" in ('OWNER', 'ADMIN', 'MEMBER')),
	CONSTRAINT "memberships_status_check" CHECK ("memberships"."status" in ('ACTIVE', 'INVITED', 'REVOKED'))
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_status_check" CHECK ("tenants"."status" in ('ACTIVE', 'PAUSED', 'CLOSED'))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_account" ADD CONSTRAINT "login_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlements" ADD CONSTRAINT "billing_entitlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_versions" ADD CONSTRAINT "campaign_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_draftVersion_owner_fk" FOREIGN KEY ("draft_version_id","id") REFERENCES "public"."campaign_versions"("id","campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_activeVersion_owner_fk" FOREIGN KEY ("active_version_id","id") REFERENCES "public"."campaign_versions"("id","campaign_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_leases" ADD CONSTRAINT "account_leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_leases" ADD CONSTRAINT "account_leases_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_campaign_version_id_campaign_versions_id_fk" FOREIGN KEY ("campaign_version_id") REFERENCES "public"."campaign_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_attempts" ADD CONSTRAINT "send_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_attempts" ADD CONSTRAINT "send_attempts_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_attempts" ADD CONSTRAINT "send_attempts_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_receipts" ADD CONSTRAINT "send_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_receipts" ADD CONSTRAINT "send_receipts_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_receipts" ADD CONSTRAINT "send_receipts_attempt_id_send_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."send_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_entries" ADD CONSTRAINT "suppression_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_entries" ADD CONSTRAINT "suppression_entries_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_entries" ADD CONSTRAINT "suppression_entries_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_override_versions" ADD CONSTRAINT "prompt_override_versions_prompt_override_id_prompt_overrides_id_fk" FOREIGN KEY ("prompt_override_id") REFERENCES "public"."prompt_overrides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_override_versions" ADD CONSTRAINT "prompt_override_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_override_versions" ADD CONSTRAINT "prompt_override_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_overrides" ADD CONSTRAINT "prompt_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_overrides" ADD CONSTRAINT "prompt_overrides_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_overrides" ADD CONSTRAINT "promptOverrides_activeVersion_owner_fk" FOREIGN KEY ("active_version_id","id") REFERENCES "public"."prompt_override_versions"("id","prompt_override_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profile_versions" ADD CONSTRAINT "style_profile_versions_style_profile_id_style_profiles_id_fk" FOREIGN KEY ("style_profile_id") REFERENCES "public"."style_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profile_versions" ADD CONSTRAINT "style_profile_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profile_versions" ADD CONSTRAINT "style_profile_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD CONSTRAINT "styleProfiles_explicitVersion_owner_fk" FOREIGN KEY ("explicit_version_id","id") REFERENCES "public"."style_profile_versions"("id","style_profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD CONSTRAINT "styleProfiles_acceptedInferredVersion_owner_fk" FOREIGN KEY ("accepted_inferred_version_id","id") REFERENCES "public"."style_profile_versions"("id","style_profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_profiles" ADD CONSTRAINT "styleProfiles_suggestedInferredVersion_owner_fk" FOREIGN KEY ("suggested_inferred_version_id","id") REFERENCES "public"."style_profile_versions"("id","style_profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditEvents_tenantId_idx" ON "audit_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "auditEvents_tenantId_entity_idx" ON "audit_events" USING btree ("tenant_id","entity_kind","entity_id");--> statement-breakpoint
CREATE INDEX "usageEvents_tenantId_idx" ON "usage_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "usageEvents_tenantId_kind_idx" ON "usage_events" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "loginAccount_userId_idx" ON "login_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "billingEvents_tenantId_idx" ON "billing_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaignVersions_campaignId_revision_idx" ON "campaign_versions" USING btree ("campaign_id","revision");--> statement-breakpoint
CREATE INDEX "campaignVersions_tenantId_idx" ON "campaign_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_draftVersionId_idx" ON "campaigns" USING btree ("draft_version_id");--> statement-breakpoint
CREATE INDEX "campaigns_activeVersionId_idx" ON "campaigns" USING btree ("active_version_id");--> statement-breakpoint
CREATE INDEX "action_events_action_idx" ON "action_events" USING btree ("action_id","recorded_at");--> statement-breakpoint
CREATE INDEX "actions_identity_idx" ON "actions" USING btree ("tenant_id","account_id","campaign_id","campaign_version_id","prospect_id","step");--> statement-breakpoint
CREATE INDEX "actions_account_state_idx" ON "actions" USING btree ("tenant_id","account_id","state");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("tenant_id","state","available_at");--> statement-breakpoint
CREATE INDEX "quota_reservations_account_period_idx" ON "quota_reservations" USING btree ("tenant_id","account_id","bucket","period_start","period_end");--> statement-breakpoint
CREATE INDEX "send_attempts_action_idx" ON "send_attempts" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "webhook_events_claim_idx" ON "webhook_events" USING btree ("tenant_id","state","available_at");--> statement-breakpoint
CREATE INDEX "evidence_prospectId_idx" ON "evidence" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "messages_conversationId_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "prospects_tenantId_idx" ON "prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "provider_accounts_tenantId_idx" ON "provider_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "promptOverrideVersions_promptOverrideId_idx" ON "prompt_override_versions" USING btree ("prompt_override_id");--> statement-breakpoint
CREATE INDEX "promptOverrides_tenantId_idx" ON "prompt_overrides" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "styleProfileVersions_styleProfileId_idx" ON "style_profile_versions" USING btree ("style_profile_id");--> statement-breakpoint
CREATE INDEX "styleProfileVersions_tenantId_idx" ON "style_profile_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "styleProfiles_explicitVersionId_idx" ON "style_profiles" USING btree ("explicit_version_id");--> statement-breakpoint
CREATE INDEX "styleProfiles_acceptedInferredVersionId_idx" ON "style_profiles" USING btree ("accepted_inferred_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "freelancer_profiles_current_unique" ON "freelancer_profiles" USING btree ("tenant_id") WHERE "freelancer_profiles"."is_current" = true;--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");