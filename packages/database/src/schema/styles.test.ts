import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  promptOverrides,
  promptOverrideVersions,
  styleProfiles,
  styleProfileVersions,
} from "./styles";

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

describe("styles schema fragment", () => {
  it("names tables distinctly", () => {
    expect(getTableConfig(styleProfiles).name).toBe("style_profiles");
    expect(getTableConfig(styleProfileVersions).name).toBe(
      "style_profile_versions"
    );
    expect(getTableConfig(promptOverrides).name).toBe("prompt_overrides");
    expect(getTableConfig(promptOverrideVersions).name).toBe(
      "prompt_override_versions"
    );
  });

  it("stores every fragment instant as a timezone-aware timestamp", () => {
    expectTimezoneAwareInstants(styleProfiles, ["created_at", "updated_at"]);
    expectTimezoneAwareInstants(styleProfileVersions, ["created_at"]);
    expectTimezoneAwareInstants(promptOverrides, ["created_at", "updated_at"]);
    expectTimezoneAwareInstants(promptOverrideVersions, ["created_at"]);
  });

  it("scopes every writable row to a tenant, so no row is cross-tenant shared", () => {
    for (const table of [
      styleProfiles,
      styleProfileVersions,
      promptOverrides,
      promptOverrideVersions,
    ]) {
      expect(columnNames(table)).toContain("tenant_id");
      const tenantColumn = getTableConfig(table).columns.find(
        (column) => column.name === "tenant_id"
      );
      expect(tenantColumn?.notNull).toBe(true);
    }
  });

  it("gives every tenant exactly one style profile row, never shared across tenants", () => {
    expect(styleProfiles.tenantId.isUnique).toBe(true);
  });

  it("keeps style_profiles as the mutable current-state row with version pointers", () => {
    expect(columnNames(styleProfiles)).toEqual([
      "id",
      "tenant_id",
      "source",
      "explicit_version_id",
      "accepted_inferred_version_id",
      "suggested_inferred_version_id",
      "revision",
      "created_at",
      "updated_at",
    ]);
    expect(styleProfiles.source.default).toBe("DEFAULT");
  });

  it("gives style_profile_versions the fields to reconstruct explicit and inferred styles with provenance", () => {
    expect(columnNames(styleProfileVersions)).toEqual([
      "id",
      "style_profile_id",
      "tenant_id",
      "kind",
      "revision",
      "tone",
      "formality",
      "greeting",
      "closing",
      "max_characters",
      "forbidden_phrases",
      "confidence",
      "model",
      "instructions",
      "examples",
      "evidence_ids",
      "created_at",
      "created_by",
    ]);
    expect(
      getTableConfig(styleProfileVersions).columns.some(
        (column) => column.name === "updated_at"
      )
    ).toBe(false);
  });

  it("stores the version revision and leaves kind-specific settings nullable until written", () => {
    expect(styleProfileVersions.revision.notNull).toBe(true);
    expect(styleProfileVersions.tone.notNull).toBe(false);
    expect(styleProfileVersions.formality.notNull).toBe(false);
    expect(styleProfileVersions.greeting.notNull).toBe(false);
    expect(styleProfileVersions.closing.notNull).toBe(false);
    expect(styleProfileVersions.maxCharacters.notNull).toBe(false);
    expect(styleProfileVersions.confidence.notNull).toBe(false);
    expect(styleProfileVersions.model.notNull).toBe(false);
  });

  it("keeps kind-specific required fields enforced by table checks", () => {
    expect(
      getTableConfig(styleProfileVersions).checks.map((check) => check.name)
    ).toEqual([
      "styleProfileVersions_explicitRequirements_check",
      "styleProfileVersions_inferredModel_check",
    ]);
  });

  it("scopes prompt overrides to exactly one campaign each", () => {
    expect(promptOverrides.campaignId.isUnique).toBe(true);
    expect(columnNames(promptOverrides)).toEqual([
      "id",
      "tenant_id",
      "campaign_id",
      "active_version_id",
      "revision",
      "created_at",
      "updated_at",
    ]);
  });

  it("gives prompt_override_versions the revisioned C3 settings and C4 step overrides", () => {
    expect(columnNames(promptOverrideVersions)).toEqual([
      "id",
      "prompt_override_id",
      "tenant_id",
      "revision",
      "settings",
      "step_overrides",
      "created_at",
      "created_by",
    ]);
    expect(promptOverrideVersions.revision.notNull).toBe(true);
    expect(promptOverrideVersions.settings.notNull).toBe(true);
    expect(promptOverrideVersions.createdBy.notNull).toBe(true);
  });

  it("never updates a prompt_override_versions row in place", () => {
    expect(
      getTableConfig(promptOverrideVersions).columns.some(
        (column) => column.name === "updated_at"
      )
    ).toBe(false);
  });

  it("cascades deletes from the owning profile/override to their version history", () => {
    const cases = [
      { childTable: styleProfileVersions, parentName: "style_profiles" },
      { childTable: promptOverrideVersions, parentName: "prompt_overrides" },
    ];
    for (const { childTable, parentName } of cases) {
      const config = getTableConfig(childTable);
      expect(config.foreignKeys).toHaveLength(1);
      const [foreignKey] = config.foreignKeys;
      expect(foreignKey.onDelete).toBe("cascade");
      expect(getTableConfig(foreignKey.reference().foreignTable).name).toBe(
        parentName
      );
    }
  });
});
