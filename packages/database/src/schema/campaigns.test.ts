import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { campaigns, campaignVersions } from "./campaigns";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).columns.map((column) => column.name);
}

describe("campaigns schema fragment", () => {
  it("names tables distinctly", () => {
    expect(getTableConfig(campaigns).name).toBe("campaigns");
    expect(getTableConfig(campaignVersions).name).toBe("campaign_versions");
  });

  it("scopes every writable row to a tenant, so no row is cross-tenant shared", () => {
    for (const table of [campaigns, campaignVersions]) {
      expect(columnNames(table)).toContain("tenant_id");
      const tenantColumn = getTableConfig(table).columns.find(
        (column) => column.name === "tenant_id"
      );
      expect(tenantColumn?.notNull).toBe(true);
    }
  });

  it("keeps campaigns as the mutable current-state row with draft/active version pointers", () => {
    expect(columnNames(campaigns)).toEqual([
      "id",
      "tenant_id",
      "status",
      "draft_version_id",
      "active_version_id",
      "outbound_paused",
      "pause_reason",
      "paused_at",
      "activated_at",
      "revision",
      "created_at",
      "updated_at",
    ]);
    expect(campaigns.revision.default).toBe(0);
    expect(campaigns.outboundPaused.default).toBe(false);
  });

  it("gives campaign_versions the exact fields to reconstruct an existing draft's inputs", () => {
    expect(columnNames(campaignVersions)).toEqual([
      "id",
      "campaign_id",
      "tenant_id",
      "revision",
      "name",
      "offer",
      "daily_quota",
      "exclusions",
      "targeting",
      "sequence",
      "business_window",
      "created_at",
      "created_by",
    ]);
  });

  it("never updates a campaign_versions row in place", () => {
    expect(campaignVersions.createdAt.onUpdateFn).toBeUndefined();
    expect(
      getTableConfig(campaignVersions).columns.some(
        (column) => column.name === "updated_at"
      )
    ).toBe(false);
  });

  it("scopes campaign_versions to its campaign with cascade delete", () => {
    const config = getTableConfig(campaignVersions);
    expect(config.foreignKeys).toHaveLength(1);
    const [foreignKey] = config.foreignKeys;
    expect(foreignKey.onDelete).toBe("cascade");
  });

  it("prevents duplicate version numbers for the same campaign", () => {
    const config = getTableConfig(campaignVersions);
    const uniqueIndex = config.indexes.find(
      (index) =>
        index.config.name === "campaignVersions_campaignId_revision_idx"
    );
    expect(uniqueIndex?.config.unique).toBe(true);
    expect(uniqueIndex?.config.columns).toHaveLength(2);
  });

  it("indexes campaigns' draft and active version pointers for lookup", () => {
    const config = getTableConfig(campaigns);
    const indexNames = config.indexes.map((index) => index.config.name);
    expect(indexNames).toContain("campaigns_draftVersionId_idx");
    expect(indexNames).toContain("campaigns_activeVersionId_idx");
  });
});
