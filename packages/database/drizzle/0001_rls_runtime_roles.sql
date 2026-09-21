-- Custom reviewed SQL: runtime roles, grants and tenant RLS.
-- Not generated from the Drizzle TypeScript schema.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relanmo_app') THEN
    CREATE ROLE relanmo_app
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relanmo_worker') THEN
    CREATE ROLE relanmo_worker
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'relanmo_auth') THEN
    CREATE ROLE relanmo_auth
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOLOGIN;
  END IF;
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO relanmo_app',
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
          TO relanmo_app, relanmo_worker
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
  END LOOP;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tenants TO relanmo_app;
  ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenants_tenant_isolation ON tenants
    FOR ALL
    TO relanmo_app, relanmo_worker
    USING (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    )
    WITH CHECK (
      id = current_setting('app.tenant_id', true)
      AND current_setting('app.tenant_id', true) <> ''
    );

  CREATE POLICY memberships_auth_pre_session_select ON memberships
    FOR SELECT
    TO relanmo_auth
    USING (
      current_setting('app.access_mode', true) = 'auth_pre_session'
      AND user_id = current_setting('app.user_id', true)
      AND current_setting('app.user_id', true) <> ''
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

  GRANT INSERT, UPDATE ON TABLE
    provider_accounts,
    prospects,
    style_profiles,
    style_profile_versions,
    conversations,
    messages,
    suppression_entries,
    actions,
    send_attempts,
    account_leases,
    quota_reservations,
    webhook_events,
    outbox_events
  TO relanmo_worker;

  GRANT INSERT ON TABLE
    evidence,
    send_receipts,
    action_events,
    usage_events,
    audit_events
  TO relanmo_worker;

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
