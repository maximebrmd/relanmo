import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { freelancerProfiles, memberships, tenants } from "./tenancy";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

function expectTimezoneAwareInstants(
  table: Parameters<typeof getTableConfig>[0],
  columns: readonly string[]
) {
  const instants = getTableConfig(table).columns.filter((column) =>
    column.getSQLType().startsWith("timestamp")
  );
  expect(new Set(instants.map((column) => column.name))).toEqual(
    new Set(columns)
  );
  for (const column of instants) {
    expect(column.getSQLType()).toBe("timestamp with time zone");
  }
}

describe("tenancy schema fragment", () => {
  it("names tables to match the C3 persistence contract", () => {
    expect(getTableConfig(tenants).name).toBe("tenants");
    expect(getTableConfig(memberships).name).toBe("memberships");
    expect(getTableConfig(freelancerProfiles).name).toBe("freelancer_profiles");
  });

  it("stores every fragment instant as a timezone-aware timestamp", () => {
    expectTimezoneAwareInstants(tenants, ["created_at"]);
    expectTimezoneAwareInstants(memberships, ["created_at", "updated_at"]);
    expectTimezoneAwareInstants(freelancerProfiles, ["created_at"]);
  });

  it("keeps the documented tenant columns and a status check", () => {
    expect(columnNames(tenants)).toEqual([
      "id",
      "display_name",
      "status",
      "created_at",
    ]);
    const { checks } = getTableConfig(tenants);
    expect(checks).toHaveLength(1);
    expect(checks[0].name).toBe("tenants_status_check");
  });

  it("prevents duplicate membership with a unique (tenant_id, user_id) constraint", () => {
    const config = getTableConfig(memberships);
    expect(config.uniqueConstraints).toHaveLength(1);
    const [uniqueConstraint] = config.uniqueConstraints;
    expect(uniqueConstraint.columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "user_id",
    ]);
    expect(uniqueConstraint.name).toBe("memberships_tenant_user_unique");
  });

  it("scopes memberships to a user with cascade delete, and to a tenant without cascade", () => {
    const config = getTableConfig(memberships);
    expect(config.foreignKeys).toHaveLength(2);
    const byForeignTable = (name: string) =>
      config.foreignKeys.find(
        (foreignKey) =>
          getTableConfig(foreignKey.reference().foreignTable).name === name
      );
    expect(byForeignTable("user")?.onDelete).toBe("cascade");
    expect(byForeignTable("tenants")?.onDelete).toBe("no action");
  });

  it("checks membership role/status against the domain enums", () => {
    const { checks } = getTableConfig(memberships);
    expect(checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "memberships_role_check",
        "memberships_status_check",
      ])
    );
  });

  it("indexes memberships by user for reverse lookups", () => {
    const config = getTableConfig(memberships);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "memberships_user_id_idx"
    );
  });

  it("keeps freelancer_profiles append-only with one current row per tenant", () => {
    const config = getTableConfig(freelancerProfiles);
    expect(config.indexes).toHaveLength(1);
    const [currentIndex] = config.indexes;
    expect(currentIndex.config.name).toBe("freelancer_profiles_current_unique");
    expect(currentIndex.config.unique).toBe(true);
    expect(currentIndex.config.where).toBeDefined();
  });

  it("gives every profile revision a unique (tenant_id, revision) pair", () => {
    const config = getTableConfig(freelancerProfiles);
    expect(config.uniqueConstraints).toHaveLength(1);
    expect(
      config.uniqueConstraints[0].columns.map((column) => column.name)
    ).toEqual(["tenant_id", "revision"]);
  });

  it("keeps the C3 ProfileFacts columns and no provider credential field", () => {
    expect(columnNames(freelancerProfiles)).toEqual([
      "id",
      "tenant_id",
      "revision",
      "is_current",
      "created_at",
      "created_by",
      "offer",
      "target_market",
      "geography",
      "skills",
      "exclusions",
      "writing_samples",
      "availability",
      "day_rate_cents",
      "preferred_french_tone",
    ]);
    const credentialLikeNames = [
      "access_token",
      "refresh_token",
      "password",
      "token",
      "unipile",
      "linkedin",
    ];
    for (const column of columnNames(freelancerProfiles)) {
      expect(
        credentialLikeNames.some((needle) => column.includes(needle))
      ).toBe(false);
    }
  });

  it("gives freelancer_profiles a non-negative revision and day-rate check", () => {
    const { checks } = getTableConfig(freelancerProfiles);
    expect(checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "freelancer_profiles_revision_check",
        "freelancer_profiles_day_rate_check",
      ])
    );
  });
});
