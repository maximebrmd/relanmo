import { randomUUID } from "node:crypto";

import {
  isMember,
  parseCampaignId,
  parseEvidenceId,
  parseExplicitStyleVersionId,
  parseInferredStyleVersionId,
  parseModelVersion,
  parseProfileVersionId,
  parsePromptVersionId,
  parseTenantId,
  parseUserId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";
import { FRENCH_TONES } from "@relanmo/domain/contracts/product";
import type { FrenchTone } from "@relanmo/domain/contracts/product";
import type {
  CurrentVersionSet,
  ExplicitStyleVersionRef,
  InferredStyleVersionRef,
  ProfileVersionRef,
} from "@relanmo/domain/contracts/versions";
import type {
  AcceptInferredStyleInput,
  AcceptInferredStyleResult,
  ExplicitStyleSettings,
  ExplicitStyleVersionRecord,
  GetStyleInput,
  GetStyleResult,
  InferredStyleVersionRecord,
  PersistenceFailure,
  PersistenceResult,
  PersistenceTransaction,
  ResetStyleToDefaultsInput,
  ResetStyleToDefaultsResult,
  RevisionConflict,
  SaveExplicitStyleInput,
  SaveExplicitStyleResult,
  SaveInferredStyleInput,
  SaveInferredStyleResult,
  SaveStyleOverrideInput,
  SaveStyleOverrideResult,
  StyleOverrideSettings,
  StyleOverrideVersionRecord,
  StyleRepository,
} from "@relanmo/domain/ports/persistence";
import { TENANT_SCOPE_MISMATCH_ERROR } from "@relanmo/domain/ports/persistence";
import { and, eq, inArray } from "drizzle-orm";

import { campaigns } from "../../schema/campaigns";
import { actions } from "../../schema/delivery";
import {
  promptOverrides,
  promptOverrideVersions,
  styleProfiles,
  styleProfileVersions,
} from "../../schema/styles";
import { freelancerProfiles } from "../../schema/tenancy";
import type { TransactionExecutor } from "../../transactions";
import { resolveTransactionExecutor } from "../../transactions";

const EMPTY_CURRENT_VERSION_SET: CurrentVersionSet = Object.freeze({
  acceptedInferredStyle: null,
  campaign: null,
  defaultPrompt: null,
  explicitStyle: null,
  model: null,
  profile: null,
  promptOverride: null,
});

const STYLE_FORMALITY_LEVELS = ["CASUAL", "NEUTRAL", "FORMAL"] as const;

type StyleProfileRow = typeof styleProfiles.$inferSelect;
type StyleVersionRow = typeof styleProfileVersions.$inferSelect;
type PromptOverrideRow = typeof promptOverrides.$inferSelect;
type PromptOverrideVersionRow = typeof promptOverrideVersions.$inferSelect;

function failure(
  code: PersistenceFailure["error"]["code"],
  detail: string
): PersistenceFailure {
  return { error: { code, detail, retryable: false }, ok: false };
}

function requireTenantScope(
  tx: PersistenceTransaction,
  tenantId: string
): PersistenceFailure | null {
  if (tx.scope.tenantId !== tenantId) {
    return { error: TENANT_SCOPE_MISMATCH_ERROR, ok: false };
  }
  return null;
}

function toInstant(value: Date): ReturnType<typeof parseUtcTimestamp> {
  return parseUtcTimestamp(value.toISOString());
}

async function takeFirst<T>(
  rows: Promise<readonly T[]>
): Promise<T | undefined> {
  const [row] = await rows;
  return row;
}

function versionRefEqual(
  left: {
    id: string;
    kind: string;
    revision: number;
    createdAt: string;
  } | null,
  right: {
    id: string;
    kind: string;
    revision: number;
    createdAt: string;
  } | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.revision === right.revision &&
    left.createdAt === right.createdAt
  );
}

function currentVersionSetsEqual(
  left: CurrentVersionSet,
  right: CurrentVersionSet
): boolean {
  return (
    versionRefEqual(left.explicitStyle, right.explicitStyle) &&
    versionRefEqual(left.acceptedInferredStyle, right.acceptedInferredStyle) &&
    versionRefEqual(left.campaign, right.campaign) &&
    versionRefEqual(left.defaultPrompt, right.defaultPrompt) &&
    versionRefEqual(left.profile, right.profile) &&
    versionRefEqual(left.promptOverride, right.promptOverride) &&
    left.model === right.model
  );
}

function revisionConflict(
  actual: CurrentVersionSet,
  expected: CurrentVersionSet
): RevisionConflict {
  return { actual, expected, outcome: "REVISION_CONFLICT" };
}

function asStringArray(value: readonly string[] | null | undefined): string[] {
  return value === null || value === undefined ? [] : [...value];
}

function parseFrenchTone(
  value: string | null,
  required: boolean
): PersistenceResult<FrenchTone | null> {
  if (value === null) {
    if (required) {
      return failure("VALIDATION", "tone is required");
    }
    return { ok: true, value: null };
  }
  if (!isMember(value, FRENCH_TONES)) {
    return failure("VALIDATION", "tone is not a supported French tone");
  }
  return { ok: true, value };
}

function parseFormality(
  value: string | null,
  required: boolean
): PersistenceResult<(typeof STYLE_FORMALITY_LEVELS)[number] | null> {
  if (value === null) {
    if (required) {
      return failure("VALIDATION", "formality is required");
    }
    return { ok: true, value: null };
  }
  if (!isMember(value, STYLE_FORMALITY_LEVELS)) {
    return failure("VALIDATION", "formality is not a supported level");
  }
  return { ok: true, value };
}

function explicitRef(row: StyleVersionRow): ExplicitStyleVersionRef {
  return {
    createdAt: toInstant(row.createdAt),
    id: parseExplicitStyleVersionId(row.id),
    kind: "STYLE_EXPLICIT",
    revision: row.revision,
  };
}

function inferredRef(row: StyleVersionRow): InferredStyleVersionRef {
  return {
    createdAt: toInstant(row.createdAt),
    id: parseInferredStyleVersionId(row.id),
    kind: "STYLE_INFERRED",
    revision: row.revision,
  };
}

function toExplicitRecord(
  row: StyleVersionRow,
  tenantId: StyleProfileRow["tenantId"]
): PersistenceResult<ExplicitStyleVersionRecord> {
  if (row.kind !== "STYLE_EXPLICIT" || row.createdBy === null) {
    return failure("INTEGRITY", "explicit style version is incomplete");
  }
  const tone = parseFrenchTone(row.tone, true);
  if (!tone.ok) {
    return tone;
  }
  const formality = parseFormality(row.formality, true);
  if (!formality.ok) {
    return formality;
  }
  if (tone.value === null || formality.value === null) {
    return failure("INTEGRITY", "explicit style version is incomplete");
  }
  return {
    ok: true,
    value: {
      createdAt: toInstant(row.createdAt),
      createdBy: parseUserId(row.createdBy),
      settings: {
        closing: row.closing,
        examples: asStringArray(row.examples),
        forbiddenPhrases: asStringArray(row.forbiddenPhrases),
        formality: formality.value,
        greeting: row.greeting,
        instructions: row.instructions,
        maxCharacters: row.maxCharacters,
        tone: tone.value,
      },
      tenantId: parseTenantId(tenantId),
      version: explicitRef(row),
    },
  };
}

function toInferredRecord(
  row: StyleVersionRow,
  tenantId: StyleProfileRow["tenantId"]
): PersistenceResult<InferredStyleVersionRecord> {
  if (row.kind !== "STYLE_INFERRED" || row.model === null) {
    return failure("INTEGRITY", "inferred style version is incomplete");
  }
  const [firstEvidence, ...restEvidence] = asStringArray(row.evidenceIds).map(
    parseEvidenceId
  );
  if (!firstEvidence) {
    return failure("INTEGRITY", "inferred style version is missing evidence");
  }
  const tone = parseFrenchTone(row.tone, false);
  if (!tone.ok) {
    return tone;
  }
  const formality = parseFormality(row.formality, false);
  if (!formality.ok) {
    return formality;
  }
  return {
    ok: true,
    value: {
      createdAt: toInstant(row.createdAt),
      model: parseModelVersion(row.model),
      settings: {
        confidence: row.confidence,
        formality: formality.value,
        tone: tone.value,
      },
      sourceEvidenceIds: [firstEvidence, ...restEvidence],
      tenantId: parseTenantId(tenantId),
      version: inferredRef(row),
    },
  };
}

function toOverrideRecord(
  override: PromptOverrideRow,
  version: PromptOverrideVersionRow
): StyleOverrideVersionRecord {
  return {
    campaignId: parseCampaignId(override.campaignId),
    createdAt: toInstant(version.createdAt),
    createdBy: parseUserId(version.createdBy),
    settings: version.settings,
    stepOverrides: version.stepOverrides,
    tenantId: parseTenantId(override.tenantId),
    version: {
      createdAt: toInstant(version.createdAt),
      id: parsePromptVersionId(version.id),
      kind: "PROMPT_OVERRIDE",
      revision: version.revision,
    },
  };
}

async function lockReadyDrafts(
  db: TransactionExecutor,
  tenantId: StyleProfileRow["tenantId"],
  campaignId?: string
): Promise<void> {
  const scope = [
    eq(actions.tenantId, parseTenantId(tenantId)),
    eq(actions.state, "READY"),
  ];
  if (campaignId !== undefined) {
    scope.push(eq(actions.campaignId, parseCampaignId(campaignId)));
  }
  await db
    .select({ id: actions.id })
    .from(actions)
    .where(and(...scope))
    .for("update");
}

async function loadProfileVersion(
  db: TransactionExecutor,
  tenantId: string
): Promise<ProfileVersionRef | null> {
  const row = await takeFirst(
    db
      .select()
      .from(freelancerProfiles)
      .where(
        and(
          eq(freelancerProfiles.tenantId, tenantId),
          eq(freelancerProfiles.isCurrent, true)
        )
      )
  );
  if (!row) {
    return null;
  }
  return {
    createdAt: toInstant(row.createdAt),
    id: parseProfileVersionId(row.id),
    kind: "PROFILE",
    revision: row.revision,
  };
}

async function loadVersionRows(
  db: TransactionExecutor,
  profileId: string,
  tenantId: string
): Promise<readonly StyleVersionRow[]> {
  return await db
    .select()
    .from(styleProfileVersions)
    .where(
      and(
        eq(styleProfileVersions.styleProfileId, profileId),
        eq(styleProfileVersions.tenantId, tenantId)
      )
    );
}

async function loadOverrides(
  db: TransactionExecutor,
  tenantId: string
): Promise<readonly StyleOverrideVersionRecord[]> {
  const overrideRows = await db
    .select()
    .from(promptOverrides)
    .where(eq(promptOverrides.tenantId, tenantId));
  const activeIds = overrideRows.flatMap((row) =>
    row.activeVersionId === null ? [] : [row.activeVersionId]
  );
  if (activeIds.length === 0) {
    return [];
  }
  const versions = await db
    .select()
    .from(promptOverrideVersions)
    .where(
      and(
        eq(promptOverrideVersions.tenantId, tenantId),
        inArray(promptOverrideVersions.id, activeIds)
      )
    );
  const versionsById = new Map(versions.map((row) => [row.id, row]));
  return overrideRows.flatMap((override) => {
    if (override.activeVersionId === null) {
      return [];
    }
    const version = versionsById.get(override.activeVersionId);
    return version ? [toOverrideRecord(override, version)] : [];
  });
}

async function assembleCurrent(
  db: TransactionExecutor,
  profile: StyleProfileRow | null,
  versions: readonly StyleVersionRow[]
): Promise<PersistenceResult<CurrentVersionSet>> {
  if (!profile) {
    return { ok: true, value: EMPTY_CURRENT_VERSION_SET };
  }
  const explicitRow =
    profile.source === "EXPLICIT"
      ? versions.find((row) => row.id === profile.explicitVersionId)
      : undefined;
  const inferredRow =
    profile.source === "INFERRED_ACCEPTED"
      ? versions.find((row) => row.id === profile.acceptedInferredVersionId)
      : undefined;
  let explicit: ExplicitStyleVersionRef | null = null;
  let acceptedInferred: InferredStyleVersionRef | null = null;
  if (explicitRow) {
    const record = toExplicitRecord(explicitRow, profile.tenantId);
    if (!record.ok) {
      return record;
    }
    explicit = record.value.version;
  }
  if (inferredRow) {
    const record = toInferredRecord(inferredRow, profile.tenantId);
    if (!record.ok) {
      return record;
    }
    acceptedInferred = record.value.version;
  }
  return {
    ok: true,
    value: {
      acceptedInferredStyle: acceptedInferred,
      campaign: null,
      defaultPrompt: null,
      explicitStyle: explicit,
      model: null,
      profile: await loadProfileVersion(db, profile.tenantId),
      promptOverride: null,
    },
  };
}

async function loadLockedProfile(
  db: TransactionExecutor,
  tenantId: string
): Promise<StyleProfileRow | null> {
  const row = await takeFirst(
    db
      .select()
      .from(styleProfiles)
      .where(eq(styleProfiles.tenantId, tenantId))
      .for("update")
  );
  return row ?? null;
}

async function ensureStyleProfile(
  db: TransactionExecutor,
  tenantId: string
): Promise<StyleProfileRow> {
  const existing = await loadLockedProfile(db, tenantId);
  if (existing) {
    return existing;
  }
  await db
    .insert(styleProfiles)
    .values({
      id: randomUUID(),
      tenantId,
    })
    .onConflictDoNothing({ target: styleProfiles.tenantId });
  const created = await loadLockedProfile(db, tenantId);
  if (!created) {
    throw new Error("style profile row was not visible after insert");
  }
  return created;
}

async function ensurePromptOverride(
  db: TransactionExecutor,
  tenantId: string,
  campaignId: string
): Promise<PromptOverrideRow> {
  const existing = await takeFirst(
    db
      .select()
      .from(promptOverrides)
      .where(
        and(
          eq(promptOverrides.tenantId, tenantId),
          eq(promptOverrides.campaignId, campaignId)
        )
      )
      .for("update")
  );
  if (existing) {
    return existing;
  }
  await db
    .insert(promptOverrides)
    .values({
      campaignId,
      id: randomUUID(),
      tenantId,
    })
    .onConflictDoNothing({ target: promptOverrides.campaignId });
  const created = await takeFirst(
    db
      .select()
      .from(promptOverrides)
      .where(
        and(
          eq(promptOverrides.tenantId, tenantId),
          eq(promptOverrides.campaignId, campaignId)
        )
      )
      .for("update")
  );
  if (!created) {
    throw new Error("prompt override row was not visible after insert");
  }
  return created;
}

async function loadStyleState(
  db: TransactionExecutor,
  tenantId: string,
  profile: StyleProfileRow | null,
  campaignId?: string
): Promise<PersistenceResult<GetStyleResult>> {
  const versions = profile
    ? await loadVersionRows(db, profile.id, tenantId)
    : [];
  const current = await assembleCurrent(db, profile, versions);
  if (!current.ok) {
    return current;
  }
  const overrides = await loadOverrides(db, tenantId);
  const promptOverride =
    overrides.find((item) => item.campaignId === campaignId)?.version ?? null;
  let explicit: ExplicitStyleVersionRecord | null = null;
  let acceptedInferred: InferredStyleVersionRecord | null = null;
  if (profile?.explicitVersionId) {
    const row = versions.find((item) => item.id === profile.explicitVersionId);
    if (row) {
      const record = toExplicitRecord(row, tenantId);
      if (!record.ok) {
        return record;
      }
      explicit = record.value;
    }
  }
  if (profile?.acceptedInferredVersionId) {
    const row = versions.find(
      (item) => item.id === profile.acceptedInferredVersionId
    );
    if (row) {
      const record = toInferredRecord(row, tenantId);
      if (!record.ok) {
        return record;
      }
      acceptedInferred = record.value;
    }
  }
  return {
    ok: true,
    value: {
      acceptedInferred,
      current: { ...current.value, promptOverride },
      explicit,
      overrides,
    },
  };
}

type ValidatedExplicitSettings = Readonly<{
  closing: string | null;
  examples: readonly string[];
  forbiddenPhrases: readonly string[];
  formality: (typeof STYLE_FORMALITY_LEVELS)[number];
  greeting: string | null;
  instructions: string | null;
  maxCharacters: number | null;
  tone: FrenchTone;
}>;

function validateExplicitSettings(
  settings: ExplicitStyleSettings
): PersistenceResult<ValidatedExplicitSettings> {
  const tone = parseFrenchTone(settings.tone, true);
  if (!tone.ok) {
    return tone;
  }
  const formality = parseFormality(settings.formality, true);
  if (!formality.ok) {
    return formality;
  }
  if (tone.value === null || formality.value === null) {
    return failure("VALIDATION", "explicit style settings are incomplete");
  }
  return {
    ok: true,
    value: {
      closing: settings.closing,
      examples: settings.examples,
      forbiddenPhrases: settings.forbiddenPhrases,
      formality: formality.value,
      greeting: settings.greeting,
      instructions: settings.instructions,
      maxCharacters: settings.maxCharacters,
      tone: tone.value,
    },
  };
}

async function getStyle(
  input: GetStyleInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<GetStyleResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  const db = resolveTransactionExecutor(tx);
  const profile =
    (await takeFirst(
      db
        .select()
        .from(styleProfiles)
        .where(eq(styleProfiles.tenantId, input.tenantId))
    )) ?? null;
  return loadStyleState(db, input.tenantId, profile, input.campaignId);
}

async function saveExplicit(
  input: SaveExplicitStyleInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<SaveExplicitStyleResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  const settings = validateExplicitSettings(input.settings);
  if (!settings.ok) {
    return settings;
  }
  const db = resolveTransactionExecutor(tx);
  const profile = await ensureStyleProfile(db, input.tenantId);
  const versions = await loadVersionRows(db, profile.id, input.tenantId);
  const current = await assembleCurrent(db, profile, versions);
  if (!current.ok) {
    return current;
  }
  if (!currentVersionSetsEqual(current.value, input.expectedCurrent.expected)) {
    return {
      ok: true,
      value: revisionConflict(current.value, input.expectedCurrent.expected),
    };
  }
  const nextRevision = profile.revision + 1;
  await db.insert(styleProfileVersions).values({
    closing: settings.value.closing,
    createdAt: new Date(input.createdAt),
    createdBy: input.createdBy,
    examples: [...settings.value.examples],
    forbiddenPhrases: [...settings.value.forbiddenPhrases],
    formality: settings.value.formality,
    greeting: settings.value.greeting,
    id: input.versionId,
    instructions: settings.value.instructions,
    kind: "STYLE_EXPLICIT",
    maxCharacters: settings.value.maxCharacters,
    revision: nextRevision,
    styleProfileId: profile.id,
    tenantId: input.tenantId,
    tone: settings.value.tone,
  });
  const updated = await takeFirst(
    db
      .update(styleProfiles)
      .set({
        explicitVersionId: input.versionId,
        revision: nextRevision,
        source: "EXPLICIT",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(styleProfiles.id, profile.id),
          eq(styleProfiles.tenantId, input.tenantId)
        )
      )
      .returning()
  );
  if (!updated) {
    return failure("INTEGRITY", "style profile was not updated");
  }
  await lockReadyDrafts(db, input.tenantId);
  const snapshot = await loadStyleState(db, input.tenantId, updated);
  if (!snapshot.ok) {
    return snapshot;
  }
  if (!snapshot.value.explicit) {
    return failure("INTEGRITY", "explicit style version was not readable");
  }
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        current: snapshot.value.current,
        style: snapshot.value.explicit,
      },
    },
  };
}

async function saveInferred(
  input: SaveInferredStyleInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<SaveInferredStyleResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  const tone = parseFrenchTone(input.settings.tone, false);
  if (!tone.ok) {
    return tone;
  }
  const formality = parseFormality(input.settings.formality, false);
  if (!formality.ok) {
    return formality;
  }
  const db = resolveTransactionExecutor(tx);
  const profile = await ensureStyleProfile(db, input.tenantId);
  const existing = await takeFirst(
    db
      .select()
      .from(styleProfileVersions)
      .where(
        and(
          eq(styleProfileVersions.id, input.versionId),
          eq(styleProfileVersions.tenantId, input.tenantId)
        )
      )
  );
  if (existing) {
    const record = toInferredRecord(existing, input.tenantId);
    if (!record.ok) {
      return record;
    }
    return {
      ok: true,
      value: { existing: record.value, outcome: "ALREADY_EXISTS" },
    };
  }
  const nextRevision = profile.revision + 1;
  await db.insert(styleProfileVersions).values({
    confidence: input.settings.confidence,
    createdAt: new Date(input.createdAt),
    evidenceIds: [...input.sourceEvidenceIds],
    formality: formality.value,
    id: input.versionId,
    kind: "STYLE_INFERRED",
    model: input.model,
    revision: nextRevision,
    styleProfileId: profile.id,
    tenantId: input.tenantId,
    tone: tone.value,
  });
  await db
    .update(styleProfiles)
    .set({
      revision: nextRevision,
      suggestedInferredVersionId: input.versionId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(styleProfiles.id, profile.id),
        eq(styleProfiles.tenantId, input.tenantId)
      )
    );
  const created = await takeFirst(
    db
      .select()
      .from(styleProfileVersions)
      .where(
        and(
          eq(styleProfileVersions.id, input.versionId),
          eq(styleProfileVersions.tenantId, input.tenantId)
        )
      )
  );
  if (!created) {
    return failure("INTEGRITY", "inferred style version was not readable");
  }
  const record = toInferredRecord(created, input.tenantId);
  if (!record.ok) {
    return record;
  }
  return { ok: true, value: { outcome: "CREATED", style: record.value } };
}

async function resetToDefaults(
  input: ResetStyleToDefaultsInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<ResetStyleToDefaultsResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  const db = resolveTransactionExecutor(tx);
  const profile = await ensureStyleProfile(db, input.tenantId);
  const versions = await loadVersionRows(db, profile.id, input.tenantId);
  const current = await assembleCurrent(db, profile, versions);
  if (!current.ok) {
    return current;
  }
  if (!currentVersionSetsEqual(current.value, input.expectedCurrent.expected)) {
    return {
      ok: true,
      value: revisionConflict(current.value, input.expectedCurrent.expected),
    };
  }
  const updated = await takeFirst(
    db
      .update(styleProfiles)
      .set({
        acceptedInferredVersionId: null,
        explicitVersionId: null,
        revision: profile.revision + 1,
        source: "DEFAULT",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(styleProfiles.id, profile.id),
          eq(styleProfiles.tenantId, input.tenantId)
        )
      )
      .returning()
  );
  if (!updated) {
    return failure("INTEGRITY", "style profile was not reset");
  }
  await lockReadyDrafts(db, input.tenantId);
  const snapshot = await loadStyleState(db, input.tenantId, updated);
  if (!snapshot.ok) {
    return snapshot;
  }
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: { current: snapshot.value.current },
    },
  };
}

async function acceptInferred(
  input: AcceptInferredStyleInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<AcceptInferredStyleResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  const db = resolveTransactionExecutor(tx);
  const profile = await loadLockedProfile(db, input.tenantId);
  if (!profile) {
    return failure("NOT_FOUND", "style profile does not exist");
  }
  const versions = await loadVersionRows(db, profile.id, input.tenantId);
  const current = await assembleCurrent(db, profile, versions);
  if (!current.ok) {
    return current;
  }
  if (!currentVersionSetsEqual(current.value, input.expectedCurrent.expected)) {
    return {
      ok: true,
      value: revisionConflict(current.value, input.expectedCurrent.expected),
    };
  }
  const target = versions.find((row) => row.id === input.versionId);
  if (!target || target.kind !== "STYLE_INFERRED") {
    return failure("NOT_FOUND", "inferred style version does not exist");
  }
  const nextRevision = profile.revision + 1;
  const explicitRemainsEffective = profile.explicitVersionId !== null;
  const updated = await takeFirst(
    db
      .update(styleProfiles)
      .set({
        acceptedInferredVersionId: input.versionId,
        revision: nextRevision,
        source: explicitRemainsEffective ? "EXPLICIT" : "INFERRED_ACCEPTED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(styleProfiles.id, profile.id),
          eq(styleProfiles.tenantId, input.tenantId)
        )
      )
      .returning()
  );
  if (!updated) {
    return failure("INTEGRITY", "style profile was not updated");
  }
  if (!explicitRemainsEffective) {
    await lockReadyDrafts(db, input.tenantId);
  }
  const snapshot = await loadStyleState(db, input.tenantId, updated);
  if (!snapshot.ok) {
    return snapshot;
  }
  if (!snapshot.value.acceptedInferred) {
    return failure("INTEGRITY", "accepted inferred style was not readable");
  }
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        current: snapshot.value.current,
        style: snapshot.value.acceptedInferred,
      },
    },
  };
}

async function saveOverride(
  input: SaveStyleOverrideInput,
  tx: PersistenceTransaction
): Promise<PersistenceResult<SaveStyleOverrideResult>> {
  const scoped = requireTenantScope(tx, input.tenantId);
  if (scoped) {
    return scoped;
  }
  if (input.settings.tone !== undefined && input.settings.tone !== null) {
    const tone = parseFrenchTone(input.settings.tone, true);
    if (!tone.ok) {
      return tone;
    }
  }
  const db = resolveTransactionExecutor(tx);
  const campaign = await takeFirst(
    db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, input.campaignId),
          eq(campaigns.tenantId, input.tenantId)
        )
      )
      .for("update")
  );
  if (!campaign) {
    return failure("NOT_FOUND", "campaign does not exist");
  }
  const profile = await ensureStyleProfile(db, input.tenantId);
  const versions = await loadVersionRows(db, profile.id, input.tenantId);
  const current = await assembleCurrent(db, profile, versions);
  if (!current.ok) {
    return current;
  }
  const activeOverride = (await loadOverrides(db, input.tenantId)).find(
    (item) => item.campaignId === input.campaignId
  );
  const contextualCurrent: CurrentVersionSet = {
    ...current.value,
    promptOverride: activeOverride?.version ?? null,
  };
  if (
    !currentVersionSetsEqual(contextualCurrent, input.expectedCurrent.expected)
  ) {
    return {
      ok: true,
      value: revisionConflict(
        contextualCurrent,
        input.expectedCurrent.expected
      ),
    };
  }
  const override = await ensurePromptOverride(
    db,
    input.tenantId,
    input.campaignId
  );
  const nextRevision = override.revision + 1;
  const settings: StyleOverrideSettings = { ...input.settings };
  await db.insert(promptOverrideVersions).values({
    createdAt: new Date(input.createdAt),
    createdBy: input.createdBy,
    id: input.versionId,
    promptOverrideId: override.id,
    revision: nextRevision,
    settings,
    stepOverrides: [...input.stepOverrides],
    tenantId: input.tenantId,
  });
  const updatedOverride = await takeFirst(
    db
      .update(promptOverrides)
      .set({
        activeVersionId: input.versionId,
        revision: nextRevision,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(promptOverrides.id, override.id),
          eq(promptOverrides.tenantId, input.tenantId)
        )
      )
      .returning()
  );
  if (!updatedOverride) {
    return failure("INTEGRITY", "prompt override was not updated");
  }
  await lockReadyDrafts(db, input.tenantId, input.campaignId);
  const version = await takeFirst(
    db
      .select()
      .from(promptOverrideVersions)
      .where(
        and(
          eq(promptOverrideVersions.id, input.versionId),
          eq(promptOverrideVersions.tenantId, input.tenantId)
        )
      )
  );
  if (!version) {
    return failure("INTEGRITY", "prompt override version was not readable");
  }
  const snapshot = await loadStyleState(
    db,
    input.tenantId,
    profile,
    input.campaignId
  );
  if (!snapshot.ok) {
    return snapshot;
  }
  return {
    ok: true,
    value: {
      outcome: "UPDATED",
      value: {
        current: snapshot.value.current,
        override: toOverrideRecord(updatedOverride, version),
      },
    },
  };
}

export function createStyleRepository(): StyleRepository {
  return {
    acceptInferred,
    get: getStyle,
    resetToDefaults,
    saveExplicit,
    saveInferred,
    saveOverride,
  };
}
