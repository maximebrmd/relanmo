/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof, no-use-before-define -- Repository methods unwrap Drizzle/pg errors and optional list cursors; helper function declarations are module-local and hoisted. */
import { randomUUID } from "node:crypto";

import type {
  AccountId,
  Evidence,
  EvidenceId,
  ProspectId,
  SuppressionEntry,
  TenantId,
  UtcTimestamp,
} from "@relanmo/domain/contracts";
import {
  parseAccountId,
  parseEvidenceId,
  parseProspectId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import type {
  AddSuppressionInput,
  AddSuppressionResult,
  EvidenceRepository,
  GetProspectInput,
  ListProspectsInput,
  PersistenceFailure,
  PersistenceResult,
  PersistenceTransaction,
  ProspectProfileSnapshot,
  ProspectRecord,
  ProspectRepository,
  ProspectStatus,
  SuppressionRepository,
  UpsertEvidenceInput,
  UpsertEvidenceResult,
  UpsertProspectInput,
  UpsertProspectResult,
} from "@relanmo/domain/ports/persistence";
import { TENANT_SCOPE_MISMATCH_ERROR } from "@relanmo/domain/ports/persistence";
import { and, asc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";

import type { KnownProspectIdentity } from "../../../../domain/src/identity";
import {
  buildIdentitySignals,
  resolveProspectIdentity,
} from "../../../../domain/src/identity";
import {
  evidence as evidenceTable,
  prospects as prospectsTable,
  providerAccounts,
  suppressionEntries,
} from "../../schema/leads";
import { mapUnexpectedError } from "../../transactions/errors";
import { resolveTransactionExecutor } from "../../transactions/registry";
import type { TransactionExecutor } from "../../transactions/registry";

export const prospectsRepositorySurface = "node-portable-server" as const;

const MAX_PAGE_SIZE = 100;

type ProspectRow = typeof prospectsTable.$inferSelect;
type EvidenceRow = typeof evidenceTable.$inferSelect;
type SuppressionRow = typeof suppressionEntries.$inferSelect;

function failure(error: PersistenceFailure["error"]): PersistenceFailure {
  return { error, ok: false };
}

function validation(detail: string): PersistenceFailure {
  return failure({ code: "VALIDATION", detail, retryable: false });
}

function notFound(detail: string): PersistenceFailure {
  return failure({ code: "NOT_FOUND", detail, retryable: false });
}

function requireTenantScope(
  tenantId: TenantId,
  tx: PersistenceTransaction
): PersistenceFailure | null {
  if (tenantId !== tx.scope.tenantId) {
    return { error: TENANT_SCOPE_MISMATCH_ERROR, ok: false };
  }
  return null;
}

function utcFromColumn(value: Date | string): UtcTimestamp {
  if (value instanceof Date) {
    return parseUtcTimestamp(value.toISOString());
  }
  return parseUtcTimestamp(value);
}

function asDate(value: UtcTimestamp): Date {
  return new Date(value);
}

function encodeCursor(createdAt: UtcTimestamp, prospectId: ProspectId): string {
  return Buffer.from(`${createdAt}|${prospectId}`, "utf-8").toString(
    "base64url"
  );
}

function decodeCursor(
  cursor: string
): Readonly<{ createdAt: Date; prospectId: ProspectId }> | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const separator = decoded.indexOf("|");
    if (separator <= 0) {
      return null;
    }
    const createdAt = new Date(decoded.slice(0, separator));
    const prospectIdRaw = decoded.slice(separator + 1);
    if (Number.isNaN(createdAt.getTime()) || prospectIdRaw.length === 0) {
      return null;
    }
    return { createdAt, prospectId: parseProspectId(prospectIdRaw) };
  } catch {
    return null;
  }
}

function readCursor(input: ListProspectsInput): string | null {
  if (!("cursor" in input)) {
    return null;
  }
  // SAFETY: C3 ListProspectsInput freezes the first-page fields; discovery
  // pagination continues by echoing `nextCursor` on this optional extra field.
  const { cursor } = input as ListProspectsInput & { cursor?: unknown };
  if (typeof cursor !== "string" || cursor.length === 0) {
    return null;
  }
  return cursor;
}

function profileFromRow(row: ProspectRow): ProspectProfileSnapshot {
  return {
    company: row.company,
    displayName: row.displayName,
    headline: row.headline,
    location: row.location,
    profileUrl: row.profileUrl,
  };
}

function identityFromRow(row: ProspectRow): KnownProspectIdentity {
  return {
    ...buildIdentitySignals({
      accountId: parseAccountId(row.accountId),
      legacyProviderMemberIds: row.legacyProviderMemberIds,
      profileUrl: row.profileUrl,
      providerMemberId: row.providerProfileId,
      tenantId: row.tenantId,
    }),
    prospectId: parseProspectId(row.id),
  };
}

function toProspectRecord(
  row: ProspectRow,
  evidenceIds: readonly EvidenceId[]
): ProspectRecord {
  return {
    accountId: parseAccountId(row.accountId),
    createdAt: utcFromColumn(row.createdAt),
    evidenceIds,
    profile: profileFromRow(row),
    prospectId: parseProspectId(row.id),
    providerProfileId: row.providerProfileId,
    status: row.status,
    tenantId: row.tenantId,
    updatedAt: utcFromColumn(row.updatedAt),
  };
}

function toEvidence(row: EvidenceRow): Evidence {
  return {
    accountId: row.accountId === null ? null : parseAccountId(row.accountId),
    capturedAt: utcFromColumn(row.capturedAt),
    contentHash: row.contentHash,
    evidenceId: parseEvidenceId(row.id),
    normalizedClaim: row.normalizedClaim,
    prospectId: parseProspectId(row.prospectId),
    provenance: row.provenance,
    sourceId: row.sourceId,
    sourceUrl: row.sourceUrl,
    tenantId: row.tenantId,
  };
}

function toSuppression(row: SuppressionRow): SuppressionEntry {
  return {
    accountId: parseAccountId(row.accountId),
    prospectId: parseProspectId(row.prospectId),
    reason: row.reason,
    recordedAt: utcFromColumn(row.recordedAt),
    tenantId: row.tenantId,
  };
}

function asPersistenceError(error: unknown): PersistenceFailure {
  let current = error;
  const seen = new Set<object>();
  while (
    typeof current === "object" &&
    current !== null &&
    !seen.has(current)
  ) {
    seen.add(current);
    if ("cause" in current && current.cause !== undefined) {
      current = current.cause;
      continue;
    }
    break;
  }
  return failure(mapUnexpectedError(current));
}

function firstRow<T>(rows: readonly T[]): T | undefined {
  const [row] = rows;
  return row;
}

function mergeLegacyIds(
  existing: readonly string[],
  extra: string | null,
  currentProviderId: string
): readonly string[] {
  if (
    extra === null ||
    extra === currentProviderId ||
    existing.includes(extra)
  ) {
    return existing;
  }
  return [...existing, extra];
}

async function loadEvidenceIds(
  db: TransactionExecutor,
  tenantId: TenantId,
  prospectIds: readonly ProspectId[]
): Promise<ReadonlyMap<ProspectId, readonly EvidenceId[]>> {
  const grouped = new Map<ProspectId, EvidenceId[]>();
  if (prospectIds.length === 0) {
    return grouped;
  }
  const rows = await db
    .select({
      evidenceId: evidenceTable.id,
      prospectId: evidenceTable.prospectId,
    })
    .from(evidenceTable)
    .where(
      and(
        eq(evidenceTable.tenantId, tenantId),
        inArray(evidenceTable.prospectId, prospectIds)
      )
    )
    .orderBy(asc(evidenceTable.createdAt), asc(evidenceTable.id));
  for (const row of rows) {
    const prospectId = parseProspectId(row.prospectId);
    const current = grouped.get(prospectId) ?? [];
    current.push(parseEvidenceId(row.evidenceId));
    grouped.set(prospectId, current);
  }
  return grouped;
}

async function loadProspect(
  db: TransactionExecutor,
  input: GetProspectInput
): Promise<ProspectRow | null> {
  const rows = await db
    .select()
    .from(prospectsTable)
    .where(
      and(
        eq(prospectsTable.tenantId, input.tenantId),
        eq(prospectsTable.accountId, input.accountId),
        eq(prospectsTable.id, input.prospectId)
      )
    )
    .limit(1);
  return firstRow(rows) ?? null;
}

async function recordFromRow(
  db: TransactionExecutor,
  row: ProspectRow
): Promise<ProspectRecord> {
  const evidenceIds = await loadEvidenceIds(db, row.tenantId, [
    parseProspectId(row.id),
  ]);
  return toProspectRecord(row, evidenceIds.get(parseProspectId(row.id)) ?? []);
}

async function loadAccountInTenant(
  db: TransactionExecutor,
  accountId: AccountId,
  tenantId: TenantId
): Promise<boolean> {
  const rows = await db
    .select({ id: providerAccounts.id })
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.id, accountId),
        eq(providerAccounts.tenantId, tenantId)
      )
    )
    .limit(1);
  return rows.length === 1;
}

const prospectRepository: ProspectRepository = {
  get: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const row = await loadProspect(db, input);
      if (!row) {
        return { ok: true, value: { prospect: null } };
      }
      return {
        ok: true,
        value: { prospect: await recordFromRow(db, row) },
      };
    } catch (error) {
      return asPersistenceError(error);
    }
  },

  list: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > MAX_PAGE_SIZE
    ) {
      return validation("limit must be an integer from 1 to 100");
    }
    const cursorValue = readCursor(input);
    const cursor = cursorValue === null ? null : decodeCursor(cursorValue);
    if (cursorValue !== null && cursor === null) {
      return validation("cursor is invalid");
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const filters = [
        eq(prospectsTable.tenantId, input.tenantId),
        eq(prospectsTable.accountId, input.accountId),
        ne(prospectsTable.status, "INVALID" satisfies ProspectStatus),
        sql`not exists (
              select 1 from suppression_entries as suppression
               where suppression.account_id = ${prospectsTable.accountId}
                 and suppression.prospect_id = ${prospectsTable.id}
            )`,
        sql`not exists (
              select 1 from conversations as conversation
               where conversation.account_id = ${prospectsTable.accountId}
                 and conversation.prospect_id = ${prospectsTable.id}
                 and conversation.ownership_kind = 'HUMAN_OWNED'
            )`,
      ];
      if (!input.includeArchived) {
        filters.push(ne(prospectsTable.status, "ARCHIVED"));
      }
      if (cursor) {
        const afterCursor = or(
          gt(prospectsTable.createdAt, cursor.createdAt),
          and(
            eq(prospectsTable.createdAt, cursor.createdAt),
            gt(prospectsTable.id, cursor.prospectId)
          )
        );
        if (afterCursor) {
          filters.push(afterCursor);
        }
      }
      const rows = await db
        .select()
        .from(prospectsTable)
        .where(and(...filters))
        .orderBy(asc(prospectsTable.createdAt), asc(prospectsTable.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit);
      const evidenceIds = await loadEvidenceIds(
        db,
        input.tenantId,
        page.map((row) => parseProspectId(row.id))
      );
      const last = page.at(-1);
      return {
        ok: true,
        value: {
          nextCursor:
            rows.length > input.limit && last
              ? encodeCursor(
                  utcFromColumn(last.createdAt),
                  parseProspectId(last.id)
                )
              : null,
          prospects: page.map((row) =>
            toProspectRecord(
              row,
              evidenceIds.get(parseProspectId(row.id)) ?? []
            )
          ),
        },
      };
    } catch (error) {
      return asPersistenceError(error);
    }
  },

  upsert: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    const signals = buildIdentitySignals({
      accountId: input.accountId,
      legacyProviderMemberIds: [],
      profileUrl: input.profile.profileUrl,
      providerMemberId: input.providerProfileId,
      tenantId: input.tenantId,
    });
    if (signals.providerMemberId === null) {
      return validation("providerProfileId is required");
    }
    try {
      const db = resolveTransactionExecutor(tx);
      if (!(await loadAccountInTenant(db, input.accountId, input.tenantId))) {
        return notFound("provider account was not found in this tenant");
      }
      const knownRows = await db
        .select()
        .from(prospectsTable)
        .where(
          and(
            eq(prospectsTable.tenantId, input.tenantId),
            eq(prospectsTable.accountId, input.accountId)
          )
        );
      const resolution = resolveProspectIdentity(
        signals,
        knownRows.map((row) => identityFromRow(row))
      );
      if (resolution.outcome === "UNRESOLVED_COLLISION") {
        return {
          ok: true,
          value: {
            conflictingProspectId:
              firstRow(resolution.candidates) ??
              parseProspectId(input.prospectId),
            outcome: "IDENTITY_COLLISION",
          },
        };
      }
      if (resolution.outcome === "MATCHED") {
        const matched = knownRows.find(
          (row) => row.id === resolution.prospectId
        );
        if (!matched) {
          return failure({
            code: "INTEGRITY",
            detail: "matched prospect was not loaded",
            retryable: false,
          });
        }
        if (
          input.prospectId !== matched.id &&
          knownRows.some((row) => row.id === input.prospectId)
        ) {
          return {
            ok: true,
            value: {
              conflictingProspectId: parseProspectId(matched.id),
              outcome: "IDENTITY_COLLISION",
            },
          };
        }
        return updateMatchedProspect(
          db,
          matched,
          input,
          signals.providerMemberId
        );
      }
      const existingId = knownRows.find((row) => row.id === input.prospectId);
      if (existingId) {
        return {
          ok: true,
          value: {
            conflictingProspectId: parseProspectId(existingId.id),
            outcome: "IDENTITY_COLLISION",
          },
        };
      }
      return insertProspect(db, input, signals.publicIdentifier);
    } catch (error) {
      return asPersistenceError(error);
    }
  },
};

async function updateMatchedProspect(
  db: TransactionExecutor,
  matched: ProspectRow,
  input: UpsertProspectInput,
  candidateProviderId: string
): Promise<PersistenceResult<UpsertProspectResult>> {
  const legacyProviderMemberIds = mergeLegacyIds(
    matched.legacyProviderMemberIds,
    candidateProviderId,
    matched.providerProfileId
  );
  const publicIdentifier =
    buildIdentitySignals({
      accountId: input.accountId,
      legacyProviderMemberIds: [],
      profileUrl: input.profile.profileUrl,
      providerMemberId: candidateProviderId,
      tenantId: input.tenantId,
    }).publicIdentifier ?? matched.publicIdentifier;
  await db
    .update(prospectsTable)
    .set({
      company: input.profile.company,
      displayName: input.profile.displayName,
      headline: input.profile.headline,
      legacyProviderMemberIds,
      location: input.profile.location,
      profileUrl: input.profile.profileUrl,
      publicIdentifier,
      updatedAt: asDate(input.observedAt),
    })
    .where(
      and(
        eq(prospectsTable.tenantId, input.tenantId),
        eq(prospectsTable.id, matched.id)
      )
    );
  const updated = await loadProspect(db, {
    accountId: parseAccountId(matched.accountId),
    prospectId: parseProspectId(matched.id),
    tenantId: input.tenantId,
  });
  if (!updated) {
    return failure({
      code: "INTEGRITY",
      detail: "updated prospect was not readable",
      retryable: false,
    });
  }
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      prospect: await recordFromRow(db, updated),
    },
  };
}

async function insertProspect(
  db: TransactionExecutor,
  input: UpsertProspectInput,
  publicIdentifier: string | null
): Promise<PersistenceResult<UpsertProspectResult>> {
  const inserted = await db
    .insert(prospectsTable)
    .values({
      accountId: input.accountId,
      company: input.profile.company,
      createdAt: asDate(input.observedAt),
      displayName: input.profile.displayName,
      headline: input.profile.headline,
      id: input.prospectId,
      location: input.profile.location,
      profileUrl: input.profile.profileUrl,
      providerProfileId: input.providerProfileId,
      publicIdentifier,
      status: "ACTIVE",
      tenantId: input.tenantId,
      updatedAt: asDate(input.observedAt),
    })
    .onConflictDoNothing()
    .returning();
  const row = firstRow(inserted);
  if (row) {
    return {
      ok: true,
      value: {
        outcome: "CREATED",
        prospect: await recordFromRow(db, row),
      },
    };
  }
  const existingRows = await db
    .select()
    .from(prospectsTable)
    .where(
      and(
        eq(prospectsTable.tenantId, input.tenantId),
        eq(prospectsTable.accountId, input.accountId),
        eq(prospectsTable.providerProfileId, input.providerProfileId)
      )
    )
    .limit(1);
  const existing = firstRow(existingRows);
  if (!existing) {
    return failure({
      code: "CONFLICT",
      detail: "prospect uniqueness conflict could not be loaded",
      retryable: false,
    });
  }
  return updateMatchedProspect(db, existing, input, input.providerProfileId);
}

const evidenceRepository: EvidenceRepository = {
  get: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const rows = await db
        .select()
        .from(evidenceTable)
        .where(
          and(
            eq(evidenceTable.tenantId, input.tenantId),
            eq(evidenceTable.id, input.evidenceId)
          )
        )
        .limit(1);
      const evidenceRow = firstRow(rows);
      return {
        ok: true,
        value: {
          evidence: evidenceRow ? toEvidence(evidenceRow) : null,
        },
      };
    } catch (error) {
      return asPersistenceError(error);
    }
  },

  list: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > MAX_PAGE_SIZE
    ) {
      return validation("limit must be an integer from 1 to 100");
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const filters = [
        eq(evidenceTable.tenantId, input.tenantId),
        eq(evidenceTable.prospectId, input.prospectId),
      ];
      if (input.accountId !== null) {
        filters.push(eq(evidenceTable.accountId, input.accountId));
      }
      const rows = await db
        .select()
        .from(evidenceTable)
        .where(and(...filters))
        .orderBy(asc(evidenceTable.capturedAt), asc(evidenceTable.id))
        .limit(input.limit);
      return {
        ok: true,
        value: { evidence: rows.map((row) => toEvidence(row)) },
      };
    } catch (error) {
      return asPersistenceError(error);
    }
  },

  upsert: async (input, tx) => {
    const scoped = requireTenantScope(input.evidence.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    const { evidence } = input;
    try {
      const db = resolveTransactionExecutor(tx);
      const prospectRows = await db
        .select({
          accountId: prospectsTable.accountId,
          id: prospectsTable.id,
        })
        .from(prospectsTable)
        .where(
          and(
            eq(prospectsTable.tenantId, evidence.tenantId),
            eq(prospectsTable.id, evidence.prospectId)
          )
        )
        .limit(1);
      const prospect = firstRow(prospectRows);
      if (!prospect) {
        return notFound("prospect was not found in this tenant");
      }
      if (
        evidence.accountId !== null &&
        evidence.accountId !== prospect.accountId
      ) {
        return failure({
          code: "FORBIDDEN",
          detail: "EVIDENCE_ACCOUNT_MISMATCH",
          retryable: false,
        });
      }
      const inserted = await db
        .insert(evidenceTable)
        .values({
          accountId: evidence.accountId,
          capturedAt: asDate(evidence.capturedAt),
          contentHash: evidence.contentHash,
          id: evidence.evidenceId,
          normalizedClaim: evidence.normalizedClaim,
          prospectId: evidence.prospectId,
          provenance: evidence.provenance,
          sourceId: evidence.sourceId,
          sourceUrl: evidence.sourceUrl,
          tenantId: evidence.tenantId,
        })
        .onConflictDoNothing()
        .returning();
      const row = firstRow(inserted);
      if (row) {
        return {
          ok: true,
          value: { evidence: toEvidence(row), outcome: "CREATED" },
        };
      }
      return loadExistingEvidence(tx, input);
    } catch (error) {
      return asPersistenceError(error);
    }
  },
};

async function loadExistingEvidence(
  tx: PersistenceTransaction,
  input: UpsertEvidenceInput
): Promise<PersistenceResult<UpsertEvidenceResult>> {
  const db = resolveTransactionExecutor(tx);
  const byUnique = await db
    .select()
    .from(evidenceTable)
    .where(
      and(
        eq(evidenceTable.tenantId, input.evidence.tenantId),
        eq(evidenceTable.prospectId, input.evidence.prospectId),
        eq(evidenceTable.sourceId, input.evidence.sourceId),
        eq(evidenceTable.normalizedClaim, input.evidence.normalizedClaim)
      )
    )
    .limit(1);
  const existing = firstRow(byUnique);
  if (existing) {
    return {
      ok: true,
      value: { evidence: toEvidence(existing), outcome: "ALREADY_EXISTS" },
    };
  }
  const byId = await db
    .select()
    .from(evidenceTable)
    .where(
      and(
        eq(evidenceTable.tenantId, input.evidence.tenantId),
        eq(evidenceTable.id, input.evidence.evidenceId)
      )
    )
    .limit(1);
  const existingById = firstRow(byId);
  if (existingById) {
    return {
      ok: true,
      value: { evidence: toEvidence(existingById), outcome: "ALREADY_EXISTS" },
    };
  }
  return failure({
    code: "CONFLICT",
    detail: "evidence uniqueness conflict could not be loaded",
    retryable: false,
  });
}

const suppressionRepository: SuppressionRepository = {
  add: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const prospect = await loadProspect(db, {
        accountId: input.accountId,
        prospectId: input.prospectId,
        tenantId: input.tenantId,
      });
      if (!prospect) {
        return notFound("prospect was not found in this tenant");
      }
      const inserted = await db
        .insert(suppressionEntries)
        .values({
          accountId: input.accountId,
          id: randomUUID(),
          prospectId: input.prospectId,
          reason: input.reason,
          recordedAt: asDate(input.recordedAt),
          tenantId: input.tenantId,
        })
        .onConflictDoNothing()
        .returning();
      const row = firstRow(inserted);
      if (row) {
        return {
          ok: true,
          value: { outcome: "ADDED", suppression: toSuppression(row) },
        };
      }
      return loadExistingSuppression(tx, input);
    } catch (error) {
      return asPersistenceError(error);
    }
  },

  get: async (input, tx) => {
    const scoped = requireTenantScope(input.tenantId, tx);
    if (scoped) {
      return scoped;
    }
    try {
      const db = resolveTransactionExecutor(tx);
      const rows = await db
        .select()
        .from(suppressionEntries)
        .where(
          and(
            eq(suppressionEntries.tenantId, input.tenantId),
            eq(suppressionEntries.accountId, input.accountId),
            eq(suppressionEntries.prospectId, input.prospectId)
          )
        )
        .limit(1);
      const suppressionRow = firstRow(rows);
      return {
        ok: true,
        value: {
          suppression: suppressionRow ? toSuppression(suppressionRow) : null,
        },
      };
    } catch (error) {
      return asPersistenceError(error);
    }
  },
};

async function loadExistingSuppression(
  tx: PersistenceTransaction,
  input: AddSuppressionInput
): Promise<PersistenceResult<AddSuppressionResult>> {
  const existing = await suppressionRepository.get(input, tx);
  if (!existing.ok) {
    return existing;
  }
  if (!existing.value.suppression) {
    return failure({
      code: "CONFLICT",
      detail: "suppression uniqueness conflict could not be loaded",
      retryable: false,
    });
  }
  return {
    ok: true,
    value: {
      outcome: "ALREADY_PRESENT",
      suppression: existing.value.suppression,
    },
  };
}

export function createProspectRepository(): ProspectRepository {
  return prospectRepository;
}

export function createEvidenceRepository(): EvidenceRepository {
  return evidenceRepository;
}

export function createSuppressionRepository(): SuppressionRepository {
  return suppressionRepository;
}
