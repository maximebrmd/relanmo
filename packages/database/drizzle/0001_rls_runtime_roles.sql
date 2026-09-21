-- Custom reviewed SQL: runtime roles, grants and tenant RLS.
-- Not generated from the Drizzle TypeScript schema.

DO $$
BEGIN
  BEGIN
    CREATE ROLE relanmo_app
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  EXCEPTION
    WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  BEGIN
    CREATE ROLE relanmo_worker
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  EXCEPTION
    WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  BEGIN
    CREATE ROLE relanmo_auth
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  EXCEPTION
    WHEN duplicate_object OR unique_violation THEN NULL;
  END;
END
$$;
--> statement-breakpoint
ALTER ROLE relanmo_app
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
--> statement-breakpoint
ALTER ROLE relanmo_worker
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
--> statement-breakpoint
ALTER ROLE relanmo_auth
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO relanmo_app, relanmo_worker, relanmo_auth;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO relanmo_app, relanmo_worker, relanmo_auth;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON TYPES TO relanmo_app, relanmo_worker, relanmo_auth;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO relanmo_app, relanmo_worker, relanmo_auth;
--> statement-breakpoint
DO $$
DECLARE
  target record;
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO relanmo_app, relanmo_worker, relanmo_auth',
    current_database()
  );

  FOR target IN
    SELECT t.typname AS type_name
      FROM pg_type AS t
      JOIN pg_namespace AS n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typtype = 'e'
  LOOP
    EXECUTE format(
      'GRANT USAGE ON TYPE %I TO relanmo_app, relanmo_worker, relanmo_auth',
      target.type_name
    );
  END LOOP;

  FOR target IN
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'tenant_id'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT ON TABLE %I TO relanmo_app',
      target.table_name
    );
    EXECUTE format(
      'ALTER TABLE %I ENABLE ROW LEVEL SECURITY',
      target.table_name
    );
    EXECUTE format(
      $policy$
        CREATE POLICY %I ON %I
          FOR ALL
          TO relanmo_app
          USING (
            tenant_id = current_setting('app.tenant_id', true)
            AND current_setting('app.tenant_id', true) <> ''
          )
          WITH CHECK (
            tenant_id = current_setting('app.tenant_id', true)
            AND current_setting('app.tenant_id', true) <> ''
          )
      $policy$,
      target.table_name || '_tenant_isolation',
      target.table_name
    );
    EXECUTE format(
      $policy$
        CREATE POLICY %I ON %I
          FOR ALL
          TO relanmo_worker
          USING (
            tenant_id = current_setting('app.tenant_id', true)
            AND current_setting('app.tenant_id', true) <> ''
          )
          WITH CHECK (
            tenant_id = current_setting('app.tenant_id', true)
            AND current_setting('app.tenant_id', true) <> ''
          )
      $policy$,
      target.table_name || '_worker_tenant_isolation',
      target.table_name
    );
  END LOOP;

  CREATE POLICY campaign_versions_tenant_parent_insert
    ON campaign_versions AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM campaigns
         WHERE campaigns.id = campaign_versions.campaign_id
           AND campaigns.tenant_id = campaign_versions.tenant_id
      )
    );

  CREATE POLICY account_leases_tenant_parent_insert
    ON account_leases AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = account_leases.account_id
           AND provider_accounts.tenant_id = account_leases.tenant_id
      )
    );

  CREATE POLICY action_events_tenant_parent_insert
    ON action_events AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM actions
         WHERE actions.id = action_events.action_id
           AND actions.tenant_id = action_events.tenant_id
      )
    );

  CREATE POLICY actions_tenant_parents_insert
    ON actions AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = actions.account_id
           AND provider_accounts.tenant_id = actions.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM prospects
         WHERE prospects.id = actions.prospect_id
           AND prospects.tenant_id = actions.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM campaigns
         WHERE campaigns.id = actions.campaign_id
           AND campaigns.tenant_id = actions.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM campaign_versions
         WHERE campaign_versions.id = actions.campaign_version_id
           AND campaign_versions.tenant_id = actions.tenant_id
      )
      AND actions.attempt_id IS NULL
    );

  CREATE POLICY actions_tenant_attempt_update
    ON actions AS RESTRICTIVE
    FOR UPDATE TO relanmo_app, relanmo_worker
    USING (true)
    WITH CHECK (
      actions.attempt_id IS NULL
      OR EXISTS (
        SELECT 1 FROM send_attempts
         WHERE send_attempts.id = actions.attempt_id
           AND send_attempts.tenant_id = actions.tenant_id
           AND send_attempts.action_id = actions.id
           AND send_attempts.account_id = actions.account_id
      )
    );

  CREATE POLICY quota_reservations_tenant_parents_insert
    ON quota_reservations AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = quota_reservations.account_id
           AND provider_accounts.tenant_id = quota_reservations.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM actions
         WHERE actions.id = quota_reservations.action_id
           AND actions.tenant_id = quota_reservations.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM campaigns
         WHERE campaigns.id = quota_reservations.campaign_id
           AND campaigns.tenant_id = quota_reservations.tenant_id
      )
    );

  CREATE POLICY send_attempts_tenant_parents_insert
    ON send_attempts AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM actions
         WHERE actions.id = send_attempts.action_id
           AND actions.tenant_id = send_attempts.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = send_attempts.account_id
           AND provider_accounts.tenant_id = send_attempts.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM quota_reservations
         WHERE quota_reservations.id = send_attempts.quota_reservation_id
           AND quota_reservations.tenant_id = send_attempts.tenant_id
           AND quota_reservations.action_id = send_attempts.action_id
           AND quota_reservations.account_id = send_attempts.account_id
      )
    );

  CREATE POLICY send_receipts_tenant_parents_insert
    ON send_receipts AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM actions
         WHERE actions.id = send_receipts.action_id
           AND actions.tenant_id = send_receipts.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM send_attempts
         WHERE send_attempts.id = send_receipts.attempt_id
           AND send_attempts.tenant_id = send_receipts.tenant_id
      )
    );

  CREATE POLICY conversations_tenant_parents_insert
    ON conversations AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = conversations.account_id
           AND provider_accounts.tenant_id = conversations.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM prospects
         WHERE prospects.id = conversations.prospect_id
           AND prospects.tenant_id = conversations.tenant_id
      )
    );

  CREATE POLICY evidence_tenant_parents_insert
    ON evidence AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      (
        evidence.account_id IS NULL
        OR EXISTS (
          SELECT 1 FROM provider_accounts
           WHERE provider_accounts.id = evidence.account_id
             AND provider_accounts.tenant_id = evidence.tenant_id
        )
      )
      AND EXISTS (
        SELECT 1 FROM prospects
         WHERE prospects.id = evidence.prospect_id
           AND prospects.tenant_id = evidence.tenant_id
      )
    );

  CREATE POLICY messages_tenant_parents_insert
    ON messages AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = messages.account_id
           AND provider_accounts.tenant_id = messages.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM prospects
         WHERE prospects.id = messages.prospect_id
           AND prospects.tenant_id = messages.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM conversations
         WHERE conversations.id = messages.conversation_id
           AND conversations.tenant_id = messages.tenant_id
      )
    );

  CREATE POLICY prospects_tenant_parent_insert
    ON prospects AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = prospects.account_id
           AND provider_accounts.tenant_id = prospects.tenant_id
      )
    );

  CREATE POLICY suppression_entries_tenant_parents_insert
    ON suppression_entries AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM provider_accounts
         WHERE provider_accounts.id = suppression_entries.account_id
           AND provider_accounts.tenant_id = suppression_entries.tenant_id
      )
      AND EXISTS (
        SELECT 1 FROM prospects
         WHERE prospects.id = suppression_entries.prospect_id
           AND prospects.tenant_id = suppression_entries.tenant_id
      )
    );

  CREATE POLICY prompt_override_versions_tenant_parent_insert
    ON prompt_override_versions AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM prompt_overrides
         WHERE prompt_overrides.id = prompt_override_versions.prompt_override_id
           AND prompt_overrides.tenant_id = prompt_override_versions.tenant_id
      )
    );

  CREATE POLICY prompt_overrides_tenant_parent_insert
    ON prompt_overrides AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM campaigns
         WHERE campaigns.id = prompt_overrides.campaign_id
           AND campaigns.tenant_id = prompt_overrides.tenant_id
      )
    );

  CREATE POLICY style_profile_versions_tenant_parent_insert
    ON style_profile_versions AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM style_profiles
         WHERE style_profiles.id = style_profile_versions.style_profile_id
           AND style_profiles.tenant_id = style_profile_versions.tenant_id
      )
    );

  CREATE POLICY usage_events_tenant_parents_insert
    ON usage_events AS RESTRICTIVE
    FOR INSERT TO relanmo_app, relanmo_worker
    WITH CHECK (
      (
        usage_events.account_id IS NULL
        OR EXISTS (
          SELECT 1 FROM provider_accounts
           WHERE provider_accounts.id = usage_events.account_id
             AND provider_accounts.tenant_id = usage_events.tenant_id
        )
      )
      AND (
        usage_events.action_id IS NULL
        OR EXISTS (
          SELECT 1 FROM actions
           WHERE actions.id = usage_events.action_id
             AND actions.tenant_id = usage_events.tenant_id
        )
      )
    );

  GRANT SELECT, INSERT ON TABLE tenants TO relanmo_app;
  ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenants_tenant_isolation ON tenants
    FOR ALL
    TO relanmo_app
    USING (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    )
    WITH CHECK (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    );

  CREATE POLICY tenants_worker_tenant_isolation ON tenants
    FOR ALL
    TO relanmo_worker
    USING (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    )
    WITH CHECK (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    );

  GRANT UPDATE (display_name, status) ON TABLE tenants TO relanmo_app;

  GRANT UPDATE (role, status, updated_at) ON TABLE memberships TO relanmo_app;

  GRANT UPDATE (is_current) ON TABLE freelancer_profiles TO relanmo_app;

  GRANT UPDATE (
    status,
    draft_version_id,
    active_version_id,
    outbound_paused,
    pause_reason,
    paused_at,
    activated_at,
    revision,
    updated_at
  ) ON TABLE campaigns TO relanmo_app;

  GRANT UPDATE (
    source,
    explicit_version_id,
    accepted_inferred_version_id,
    suggested_inferred_version_id,
    revision,
    updated_at
  ) ON TABLE style_profiles TO relanmo_app;

  GRANT UPDATE (active_version_id, revision, updated_at)
    ON TABLE prompt_overrides TO relanmo_app;

  GRANT UPDATE (provider_customer_id, updated_at)
    ON TABLE billing_customers TO relanmo_app;

  GRANT UPDATE (
    provider_customer_id,
    state,
    current_period_end,
    updated_at
  ) ON TABLE subscriptions TO relanmo_app;

  GRANT UPDATE (
    state,
    active,
    effective_at,
    valid_until,
    provider_subscription_id,
    updated_at
  ) ON TABLE billing_entitlements TO relanmo_app;

  GRANT UPDATE (
    provider_user_id,
    status,
    health_reason,
    health_observed_at,
    health_capabilities,
    last_successful_reconciliation_at,
    revision,
    updated_at
  ) ON TABLE provider_accounts TO relanmo_app;

  GRANT UPDATE (
    legacy_provider_member_ids,
    public_identifier,
    display_name,
    headline,
    company,
    location,
    profile_url,
    status,
    updated_at
  ) ON TABLE prospects TO relanmo_app;

  GRANT UPDATE (
    status,
    ownership_kind,
    ownership_reason,
    owner_user_id,
    ownership_recorded_at,
    ownership_revision,
    human_owned_at,
    last_incoming_at,
    last_message_at,
    updated_at
  ) ON TABLE conversations TO relanmo_app;

  GRANT UPDATE (owner, fence, acquired_at, expires_at)
    ON TABLE account_leases TO relanmo_app;

  GRANT UPDATE (state, updated_at)
    ON TABLE quota_reservations TO relanmo_app;

  GRANT UPDATE (
    state,
    attempt,
    last_error,
    lease_worker_id,
    lease_fence,
    lease_expires_at,
    processed_at,
    quarantined_at,
    available_at
  ) ON TABLE webhook_events TO relanmo_app;

  GRANT UPDATE (
    state,
    attempt,
    last_error,
    lease_worker_id,
    lease_fence,
    lease_expires_at,
    available_at
  ) ON TABLE outbox_events TO relanmo_app;

  GRANT UPDATE (
    state,
    state_at,
    attempt_id,
    lease_expires_at,
    lease_fence,
    provider_message_id,
    failure_reason,
    unknown_reason
  ) ON TABLE actions TO relanmo_app;

  CREATE POLICY memberships_auth_pre_session_select ON memberships
    FOR SELECT
    TO relanmo_auth
    USING (
      current_setting('app.access_mode', true) = 'auth_pre_session'
      AND user_id = current_setting('app.user_id', true)
      AND current_setting('app.user_id', true) <> ''
      AND status = 'ACTIVE'
    );

  CREATE POLICY tenants_auth_pre_session_select ON tenants
    FOR SELECT
    TO relanmo_auth
    USING (
      current_setting('app.access_mode', true) = 'auth_pre_session'
      AND EXISTS (
        SELECT 1
          FROM memberships
         WHERE memberships.tenant_id = tenants.id
           AND memberships.user_id = current_setting('app.user_id', true)
           AND current_setting('app.user_id', true) <> ''
           AND memberships.status = 'ACTIVE'
      )
    );

  GRANT SELECT ON TABLE
    tenants,
    memberships,
    freelancer_profiles,
    campaigns,
    campaign_versions,
    style_profiles,
    style_profile_versions,
    prompt_overrides,
    prompt_override_versions,
    billing_entitlements,
    provider_accounts,
    prospects,
    evidence,
    conversations,
    messages,
    suppression_entries,
    actions,
    send_attempts,
    send_receipts,
    account_leases,
    quota_reservations,
    webhook_events,
    outbox_events,
    action_events,
    usage_events,
    audit_events
  TO relanmo_worker;

  GRANT INSERT ON TABLE
    provider_accounts,
    prospects,
    conversations,
    messages,
    suppression_entries,
    account_leases,
    quota_reservations,
    webhook_events,
    outbox_events
  TO relanmo_worker;

  GRANT UPDATE (
    provider_user_id,
    status,
    health_reason,
    health_observed_at,
    health_capabilities,
    last_successful_reconciliation_at,
    revision,
    updated_at
  ) ON TABLE provider_accounts TO relanmo_worker;

  GRANT UPDATE (
    legacy_provider_member_ids,
    public_identifier,
    display_name,
    headline,
    company,
    location,
    profile_url,
    status,
    updated_at
  ) ON TABLE prospects TO relanmo_worker;

  GRANT UPDATE (
    suggested_inferred_version_id,
    revision,
    updated_at
  ) ON TABLE style_profiles TO relanmo_worker;

  GRANT UPDATE (
    status,
    ownership_kind,
    ownership_reason,
    owner_user_id,
    ownership_recorded_at,
    ownership_revision,
    human_owned_at,
    last_incoming_at,
    last_message_at,
    updated_at
  ) ON TABLE conversations TO relanmo_worker;

  GRANT UPDATE (owner, fence, acquired_at, expires_at)
    ON TABLE account_leases TO relanmo_worker;

  GRANT UPDATE (state, updated_at)
    ON TABLE quota_reservations TO relanmo_worker;

  GRANT UPDATE (
    state,
    attempt,
    last_error,
    lease_worker_id,
    lease_fence,
    lease_expires_at,
    processed_at,
    quarantined_at,
    available_at
  ) ON TABLE webhook_events TO relanmo_worker;

  GRANT UPDATE (
    state,
    attempt,
    last_error,
    lease_worker_id,
    lease_fence,
    lease_expires_at,
    available_at
  ) ON TABLE outbox_events TO relanmo_worker;

  GRANT INSERT ON TABLE
    evidence,
    style_profile_versions,
    actions,
    send_attempts,
    send_receipts,
    action_events,
    usage_events,
    audit_events
  TO relanmo_worker;

  GRANT UPDATE (
    state,
    state_at,
    attempt_id,
    lease_expires_at,
    lease_fence,
    provider_message_id,
    failure_reason,
    unknown_reason
  ) ON TABLE actions TO relanmo_worker;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    "user",
    session,
    login_account,
    verification,
    rate_limit
  TO relanmo_auth;

  GRANT SELECT ON TABLE tenants, memberships TO relanmo_auth;
END
$$;
