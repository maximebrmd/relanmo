/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- Public parsers are the explicit untrusted-input boundary for these contracts. */

import {
  ACTION_FAILURE_REASONS,
  ACTION_STATES,
  ACTION_UNKNOWN_REASONS,
} from "./action";
import type {
  Action,
  ActionFailureReason,
  ActionIdentity,
  ActionLease,
  ActionLifecycle,
  ActionLifecycleEvent,
  ActionPayload,
  ActionUnknownReason,
} from "./action";
import type { DuePlan } from "./due-plan";
import {
  DRAFT_STATUSES,
  ELIGIBILITY_FACT_STATUSES,
  ELIGIBILITY_OUTCOMES,
  ELIGIBILITY_REASON_CODES,
} from "./eligibility";
import type {
  AcceptanceFact,
  EligibilityDraftSnapshot,
  EligibilityEvidenceSnapshot,
  EligibilityCheck,
  EligibilityReason,
  EligibilityReasonCode,
  EligibilityResult,
  EligibilitySnapshot,
  EligibilityVersionSnapshot,
} from "./eligibility";
import { EVIDENCE_ASSERTION_KINDS, EVIDENCE_PROVENANCE } from "./evidence";
import type {
  Evidence,
  EvidenceAssertion,
  EvidenceProvenance,
} from "./evidence";
import {
  parseAccountId,
  parseActionId,
  parseBatchId,
  parseCampaignId,
  parseCampaignVersionId,
  parseConversationId,
  parseEvidenceId,
  parseExplicitStyleVersionId,
  parseInferredStyleVersionId,
  parseMessageId,
  parseModelVersion as parseModelVersionId,
  parseOutboxEventId,
  parseProfileVersionId,
  parseProspectId,
  parsePromptVersionId,
  parsePromptOverrideVersionId,
  parseSendAttemptId,
  parseTenantId,
  parseUserId,
  parseWorkflowId,
} from "./ids";
import {
  ATTACHMENT_KINDS,
  MESSAGE_DIRECTIONS,
  MESSAGE_SOURCES,
} from "./message";
import type {
  Attachment,
  IncomingMessageEvent,
  Message,
  MessageBase,
} from "./message";
import {
  BOT_OWNERSHIP_REASONS,
  HUMAN_OWNERSHIP_REASONS,
  OWNERSHIP_KINDS,
  OWNERSHIP_REASONS,
  SUPPRESSION_REASONS,
} from "./ownership";
import type {
  AccountProspectOwnership,
  BotOwnershipReason,
  HumanOwnershipReason,
  Ownership,
  OwnershipReason,
  SuppressionEntry,
  SuppressionReason,
} from "./ownership";
import {
  ContractValidationError,
  expectArrayOf,
  expectBoolean,
  expectInteger,
  expectNonEmptyString,
  expectNullableString,
  expectRecord,
  expectString,
  isMember,
  isNonEmpty,
  isNull,
  readRequired,
  safeParse,
} from "./runtime";
import type { SafeParseResult } from "./runtime";
import {
  BUSINESS_WINDOW_STATUSES,
  parseBusinessTimeZone,
  parseBusinessWeekday,
  parseDirectMessageStep,
  parseLocalBusinessTime,
  parseSequenceStep,
  parseUtcTimestamp,
} from "./values";
import type {
  BusinessWindow,
  BusinessWindowConfiguration,
  BusinessWindowEvaluation,
} from "./values";
import { VERSION_KINDS } from "./versions";
import type {
  CurrentVersionSet,
  DraftSourceVersions,
  VersionKind,
  VersionRef,
} from "./versions";
import {
  OUTBOX_EVENT_KINDS,
  WORKFLOW_ACTIVITY_NAMES,
  WORKFLOW_PAUSE_REASONS,
  WORKFLOW_SIGNAL_NAMES,
  WORKFLOW_ID_PREFIX,
  WORKFLOW_UNITS,
} from "./workflow";
import type {
  DiscoveryQualification,
  SequenceDispatchActionResult,
  SequenceDraftActionResult,
  WorkflowActivityInput,
  WorkflowActivityName,
  WorkflowActivityResult,
  WorkflowIdentity,
  WorkflowSignal,
} from "./workflow";

function member<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string
): T[number] {
  const parsed = expectString(value, path);
  if (!isMember(parsed, allowed)) {
    throw new ContractValidationError(`${path} has an unsupported value`);
  }
  return parsed;
}

function nullable<T>(value: unknown, parser: (input: unknown) => T): T | null {
  return isNull(value) ? null : parser(value);
}

function nullableNonEmptyString(value: unknown, path: string): string | null {
  if (isNull(value)) {
    return null;
  }
  return expectNonEmptyString(value, path);
}

function cursor(value: unknown, path: string): string | null {
  return nullableNonEmptyString(value, path);
}

function parseVersionRef(value: unknown, path: string): VersionRef {
  const record = expectRecord(value, path);
  const kind = member(
    readRequired(record, "kind"),
    VERSION_KINDS,
    `${path}.kind`
  );
  const common = {
    createdAt: parseUtcTimestamp(readRequired(record, "createdAt")),
    revision: expectInteger(
      readRequired(record, "revision"),
      `${path}.revision`,
      1
    ),
  };

  switch (kind) {
    case "PROFILE": {
      return Object.freeze({
        ...common,
        id: parseProfileVersionId(readRequired(record, "id")),
        kind,
      });
    }
    case "CAMPAIGN": {
      return Object.freeze({
        ...common,
        id: parseCampaignVersionId(readRequired(record, "id")),
        kind,
      });
    }
    case "STYLE_EXPLICIT": {
      return Object.freeze({
        ...common,
        id: parseExplicitStyleVersionId(readRequired(record, "id")),
        kind,
      });
    }
    case "STYLE_INFERRED": {
      return Object.freeze({
        ...common,
        id: parseInferredStyleVersionId(readRequired(record, "id")),
        kind,
      });
    }
    case "PROMPT_DEFAULT": {
      return Object.freeze({
        ...common,
        id: parsePromptVersionId(readRequired(record, "id")),
        kind,
      });
    }
    case "PROMPT_OVERRIDE": {
      return Object.freeze({
        ...common,
        id: parsePromptOverrideVersionId(readRequired(record, "id")),
        kind,
      });
    }
    default: {
      throw new ContractValidationError(`${path}.kind is unsupported`);
    }
  }
}

function versionOfKind<Kind extends VersionKind>(
  value: unknown,
  path: string,
  kind: Kind
): Extract<VersionRef, { kind: Kind }> {
  const parsed = parseVersionRef(value, path);
  if (parsed.kind !== kind) {
    throw new ContractValidationError(`${path}.kind must be ${kind}`);
  }
  // SAFETY: The discriminant check above narrows this reference to the requested kind.
  return parsed as Extract<VersionRef, { kind: Kind }>;
}

export function parseDraftSourceVersions(value: unknown): DraftSourceVersions {
  const record = expectRecord(value, "sourceVersions");
  return Object.freeze({
    acceptedInferredStyle: nullable(
      readRequired(record, "acceptedInferredStyle"),
      (input) =>
        versionOfKind(
          input,
          "sourceVersions.acceptedInferredStyle",
          "STYLE_INFERRED"
        )
    ),
    campaign: versionOfKind(
      readRequired(record, "campaign"),
      "sourceVersions.campaign",
      "CAMPAIGN"
    ),
    defaultPrompt: versionOfKind(
      readRequired(record, "defaultPrompt"),
      "sourceVersions.defaultPrompt",
      "PROMPT_DEFAULT"
    ),
    explicitStyle: nullable(readRequired(record, "explicitStyle"), (input) =>
      versionOfKind(input, "sourceVersions.explicitStyle", "STYLE_EXPLICIT")
    ),
    model: parseModelVersionId(readRequired(record, "model")),
    profile: nullable(readRequired(record, "profile"), (input) =>
      versionOfKind(input, "sourceVersions.profile", "PROFILE")
    ),
    promptOverride: nullable(
      readRequired(record, "promptOverride"),
      (input) =>
        versionOfKind(
          input,
          "sourceVersions.promptOverride",
          "PROMPT_OVERRIDE"
        )
    ),
  });
}

export function parseCurrentVersionSet(value: unknown): CurrentVersionSet {
  const record = expectRecord(value, "currentVersions");
  return Object.freeze({
    acceptedInferredStyle: nullable(
      readRequired(record, "acceptedInferredStyle"),
      (input) =>
        versionOfKind(
          input,
          "currentVersions.acceptedInferredStyle",
          "STYLE_INFERRED"
        )
    ),
    campaign: nullable(readRequired(record, "campaign"), (input) =>
      versionOfKind(input, "currentVersions.campaign", "CAMPAIGN")
    ),
    defaultPrompt: nullable(readRequired(record, "defaultPrompt"), (input) =>
      versionOfKind(input, "currentVersions.defaultPrompt", "PROMPT_DEFAULT")
    ),
    explicitStyle: nullable(readRequired(record, "explicitStyle"), (input) =>
      versionOfKind(input, "currentVersions.explicitStyle", "STYLE_EXPLICIT")
    ),
    model: nullable(readRequired(record, "model"), parseModelVersionId),
    profile: nullable(readRequired(record, "profile"), (input) =>
      versionOfKind(input, "currentVersions.profile", "PROFILE")
    ),
    promptOverride: nullable(
      readRequired(record, "promptOverride"),
      (input) =>
        versionOfKind(
          input,
          "currentVersions.promptOverride",
          "PROMPT_OVERRIDE"
        )
    ),
  });
}

function parseOwnershipReason(value: unknown, path: string): OwnershipReason {
  return member(value, OWNERSHIP_REASONS, path);
}

function parseBotOwnershipReason(
  value: unknown,
  path: string
): BotOwnershipReason {
  return member(value, BOT_OWNERSHIP_REASONS, path);
}

function parseHumanOwnershipReason(
  value: unknown,
  path: string
): HumanOwnershipReason {
  return member(value, HUMAN_OWNERSHIP_REASONS, path);
}

export function parseOwnership(value: unknown): Ownership {
  const record = expectRecord(value, "ownership");
  const kind = member(
    readRequired(record, "kind"),
    OWNERSHIP_KINDS,
    "ownership.kind"
  );
  const ownerUserId = nullable(
    readRequired(record, "ownerUserId"),
    parseUserId
  );
  const recordedAt = parseUtcTimestamp(readRequired(record, "recordedAt"));

  if (kind === "BOT_ELIGIBLE") {
    if (ownerUserId !== null) {
      throw new ContractValidationError(
        "BOT_ELIGIBLE ownership cannot name a human owner"
      );
    }
    return Object.freeze({
      kind,
      ownerUserId: null,
      reason: parseBotOwnershipReason(
        readRequired(record, "reason"),
        "ownership.reason"
      ),
      recordedAt,
    });
  }

  return Object.freeze({
    kind,
    ownerUserId,
    reason: parseHumanOwnershipReason(
      readRequired(record, "reason"),
      "ownership.reason"
    ),
    recordedAt,
  });
}

function parseSuppressionReason(
  value: unknown,
  path: string
): SuppressionReason {
  return member(value, SUPPRESSION_REASONS, path);
}

export function parseAccountProspectOwnership(
  value: unknown
): AccountProspectOwnership {
  const record = expectRecord(value, "accountProspectOwnership");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    ownership: parseOwnership(readRequired(record, "ownership")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseSuppressionEntry(value: unknown): SuppressionEntry {
  const record = expectRecord(value, "suppression");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    reason: parseSuppressionReason(
      readRequired(record, "reason"),
      "suppression.reason"
    ),
    recordedAt: parseUtcTimestamp(readRequired(record, "recordedAt")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

function parseEvidenceProvenance(
  value: unknown,
  path: string
): EvidenceProvenance {
  return member(value, EVIDENCE_PROVENANCE, path);
}

function parseEvidenceAssertion(
  value: unknown,
  path: string
): EvidenceAssertion {
  const record = expectRecord(value, path);
  const detail = nullableNonEmptyString(
    readRequired(record, "detail"),
    `${path}.detail`
  );
  const assertionValue = expectNonEmptyString(
    readRequired(record, "value"),
    `${path}.value`
  );
  if (detail !== null && detail.length > 1000) {
    throw new ContractValidationError(`${path}.detail exceeds 1000 characters`);
  }
  if (assertionValue.length > 1000) {
    throw new ContractValidationError(`${path}.value exceeds 1000 characters`);
  }
  return Object.freeze({
    detail,
    kind: member(
      readRequired(record, "kind"),
      EVIDENCE_ASSERTION_KINDS,
      `${path}.kind`
    ),
    value: assertionValue,
  });
}

export function parseEvidence(value: unknown): Evidence {
  const record = expectRecord(value, "evidence");
  const normalizedClaim = expectNonEmptyString(
    readRequired(record, "normalizedClaim"),
    "evidence.normalizedClaim"
  );
  if (normalizedClaim.length > 1000) {
    throw new ContractValidationError(
      "evidence.normalizedClaim exceeds 1000 characters"
    );
  }
  return Object.freeze({
    accountId: nullable(readRequired(record, "accountId"), parseAccountId),
    assertions: expectArrayOf(
      readRequired(record, "assertions"),
      parseEvidenceAssertion,
      "evidence.assertions",
      20
    ),
    capturedAt: parseUtcTimestamp(readRequired(record, "capturedAt")),
    contentHash: nullableNonEmptyString(
      readRequired(record, "contentHash"),
      "evidence.contentHash"
    ),
    evidenceId: parseEvidenceId(readRequired(record, "evidenceId")),
    normalizedClaim,
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    provenance: parseEvidenceProvenance(
      readRequired(record, "provenance"),
      "evidence.provenance"
    ),
    sourceId: expectNonEmptyString(
      readRequired(record, "sourceId"),
      "evidence.sourceId"
    ),
    sourceUrl: nullableNonEmptyString(
      readRequired(record, "sourceUrl"),
      "evidence.sourceUrl"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

function parseAttachment(value: unknown, path: string): Attachment {
  const record = expectRecord(value, path);
  return Object.freeze({
    contentType: nullableNonEmptyString(
      readRequired(record, "contentType"),
      `${path}.contentType`
    ),
    kind: member(
      readRequired(record, "kind"),
      ATTACHMENT_KINDS,
      `${path}.kind`
    ),
    name: nullableNonEmptyString(readRequired(record, "name"), `${path}.name`),
    providerAttachmentId: nullableNonEmptyString(
      readRequired(record, "providerAttachmentId"),
      `${path}.providerAttachmentId`
    ),
    sizeBytes: nullable(readRequired(record, "sizeBytes"), (input) =>
      expectInteger(input, `${path}.sizeBytes`, 0)
    ),
    url: nullableNonEmptyString(readRequired(record, "url"), `${path}.url`),
  });
}

const INBOUND_ACTORS = ["PROSPECT", "UNKNOWN"] as const;
const OUTBOUND_ACTORS = ["BOT", "OWNER", "UNKNOWN"] as const;

export function parseMessage(value: unknown): Message {
  const record = expectRecord(value, "message");
  const direction = member(
    readRequired(record, "direction"),
    MESSAGE_DIRECTIONS,
    "message.direction"
  );
  const text = expectNullableString(
    readRequired(record, "text"),
    "message.text"
  );
  const attachments = expectArrayOf(
    readRequired(record, "attachments"),
    parseAttachment,
    "message.attachments",
    20
  );
  if ((text === null || text.length === 0) && attachments.length === 0) {
    throw new ContractValidationError(
      "message must contain text or at least one attachment"
    );
  }

  const base: MessageBase = Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    attachments,
    conversationId: parseConversationId(readRequired(record, "conversationId")),
    messageId: parseMessageId(readRequired(record, "messageId")),
    occurredAt: parseUtcTimestamp(readRequired(record, "occurredAt")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    providerMessageId: nullableNonEmptyString(
      readRequired(record, "providerMessageId"),
      "message.providerMessageId"
    ),
    receivedAt: parseUtcTimestamp(readRequired(record, "receivedAt")),
    source: member(
      readRequired(record, "source"),
      MESSAGE_SOURCES,
      "message.source"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    text,
  });

  if (direction === "INBOUND") {
    const actor = member(
      readRequired(record, "actor"),
      INBOUND_ACTORS,
      "message.actor"
    );
    if (base.source === "SEND_LEDGER") {
      throw new ContractValidationError(
        "SEND_LEDGER cannot be the source of an inbound message"
      );
    }
    return Object.freeze({ ...base, actor, direction });
  }

  const actor = member(
    readRequired(record, "actor"),
    OUTBOUND_ACTORS,
    "message.actor"
  );
  return Object.freeze({ ...base, actor, direction });
}

export function parseIncomingMessageEvent(
  value: unknown
): IncomingMessageEvent {
  const record = expectRecord(value, "incomingMessageEvent");
  const type = member(
    readRequired(record, "type"),
    ["INCOMING_MESSAGE"],
    "incomingMessageEvent.type"
  );
  const message = parseMessage(readRequired(record, "message"));
  if (message.direction !== "INBOUND") {
    throw new ContractValidationError(
      "INCOMING_MESSAGE events must contain an inbound message"
    );
  }
  return Object.freeze({
    dedupeKey: expectNonEmptyString(
      readRequired(record, "dedupeKey"),
      "incomingMessageEvent.dedupeKey"
    ),
    message,
    receivedAt: parseUtcTimestamp(readRequired(record, "receivedAt")),
    type,
  });
}

function parseActionPayload(value: unknown): ActionPayload {
  const record = expectRecord(value, "action.payload");
  const kind = member(
    readRequired(record, "kind"),
    ["INVITATION_WITHOUT_NOTE", "DIRECT_MESSAGE"],
    "action.payload.kind"
  );
  if (kind === "INVITATION_WITHOUT_NOTE") {
    const step = parseSequenceStep(readRequired(record, "step"));
    if (step !== "INVITATION" || !isNull(readRequired(record, "note"))) {
      throw new ContractValidationError(
        "INVITATION_WITHOUT_NOTE must have step INVITATION and a null note"
      );
    }
    return Object.freeze({ kind, note: null, step });
  }

  const step = parseDirectMessageStep(readRequired(record, "step"));
  return Object.freeze({
    kind,
    step,
    text: expectNonEmptyString(
      readRequired(record, "text"),
      "action.payload.text"
    ),
  });
}

function parseActionFailureReason(
  value: unknown,
  path: string
): ActionFailureReason {
  return member(value, ACTION_FAILURE_REASONS, path);
}

function parseActionUnknownReason(
  value: unknown,
  path: string
): ActionUnknownReason {
  return member(value, ACTION_UNKNOWN_REASONS, path);
}

function parseActionLease(value: unknown): ActionLease {
  const record = expectRecord(value, "action.lease");
  return Object.freeze({
    expiresAt: parseUtcTimestamp(readRequired(record, "expiresAt")),
    fence: expectInteger(
      readRequired(record, "fence"),
      "action.lease.fence",
      1
    ),
  });
}

interface LifecycleParts {
  attemptId: ActionLifecycle["attemptId"];
  failureReason: ActionLifecycle["failureReason"];
  lease: ActionLifecycle["lease"];
  providerMessageId: string | null;
  state: "READY" | "IN_FLIGHT" | "CONFIRMED" | "FAILED" | "UNKNOWN";
  stateAt: ActionLifecycle["stateAt"];
  unknownReason: ActionLifecycle["unknownReason"];
}

function parseLifecycleParts(value: unknown): LifecycleParts {
  const record = expectRecord(value, "action");
  return {
    attemptId: nullable(readRequired(record, "attemptId"), parseSendAttemptId),
    failureReason: nullable(readRequired(record, "failureReason"), (input) =>
      parseActionFailureReason(input, "action.failureReason")
    ),
    lease: nullable(readRequired(record, "lease"), parseActionLease),
    providerMessageId: nullableNonEmptyString(
      readRequired(record, "providerMessageId"),
      "action.providerMessageId"
    ),
    state: member(readRequired(record, "state"), ACTION_STATES, "action.state"),
    stateAt: parseUtcTimestamp(readRequired(record, "stateAt")),
    unknownReason: nullable(readRequired(record, "unknownReason"), (input) =>
      parseActionUnknownReason(input, "action.unknownReason")
    ),
  };
}

type ReadyLifecycle = Extract<ActionLifecycle, { state: "READY" }>;
type InFlightLifecycle = Extract<ActionLifecycle, { state: "IN_FLIGHT" }>;
type ConfirmedLifecycle = Extract<ActionLifecycle, { state: "CONFIRMED" }>;
type FailedLifecycle = Extract<ActionLifecycle, { state: "FAILED" }>;
type UnknownLifecycle = Extract<ActionLifecycle, { state: "UNKNOWN" }>;

function parseReadyLifecycle(parts: LifecycleParts): ReadyLifecycle {
  if (
    parts.attemptId !== null ||
    parts.failureReason !== null ||
    parts.lease !== null ||
    parts.providerMessageId !== null ||
    parts.unknownReason !== null
  ) {
    throw new ContractValidationError(
      "READY actions cannot carry send outcome fields"
    );
  }
  return Object.freeze({
    attemptId: null,
    failureReason: null,
    lease: null,
    providerMessageId: null,
    state: "READY",
    stateAt: parts.stateAt,
    unknownReason: null,
  });
}

function parseInFlightLifecycle(parts: LifecycleParts): InFlightLifecycle {
  if (
    parts.attemptId === null ||
    parts.failureReason !== null ||
    parts.lease === null ||
    parts.providerMessageId !== null ||
    parts.unknownReason !== null
  ) {
    throw new ContractValidationError(
      "IN_FLIGHT actions require an attempt and lease and cannot carry an outcome"
    );
  }
  return Object.freeze({
    attemptId: parts.attemptId,
    failureReason: null,
    lease: parts.lease,
    providerMessageId: null,
    state: "IN_FLIGHT",
    stateAt: parts.stateAt,
    unknownReason: null,
  });
}

function parseConfirmedLifecycle(parts: LifecycleParts): ConfirmedLifecycle {
  if (
    parts.attemptId === null ||
    parts.failureReason !== null ||
    parts.lease !== null ||
    parts.providerMessageId === null ||
    parts.unknownReason !== null
  ) {
    throw new ContractValidationError(
      "CONFIRMED actions require an attempt and provider message ID"
    );
  }
  return Object.freeze({
    attemptId: parts.attemptId,
    failureReason: null,
    lease: null,
    providerMessageId: parts.providerMessageId,
    state: "CONFIRMED",
    stateAt: parts.stateAt,
    unknownReason: null,
  });
}

function parseFailedLifecycle(parts: LifecycleParts): FailedLifecycle {
  if (
    parts.failureReason === null ||
    parts.lease !== null ||
    parts.providerMessageId !== null ||
    parts.unknownReason !== null
  ) {
    throw new ContractValidationError(
      "FAILED actions require a failure reason and cannot carry a receipt"
    );
  }
  return Object.freeze({
    attemptId: parts.attemptId,
    failureReason: parts.failureReason,
    lease: null,
    providerMessageId: null,
    state: "FAILED",
    stateAt: parts.stateAt,
    unknownReason: null,
  });
}

function parseUnknownLifecycle(parts: LifecycleParts): UnknownLifecycle {
  if (
    parts.attemptId === null ||
    parts.failureReason !== null ||
    parts.lease !== null ||
    parts.providerMessageId !== null ||
    parts.unknownReason === null
  ) {
    throw new ContractValidationError(
      "UNKNOWN actions require an attempt and explicit reconciliation reason"
    );
  }
  return Object.freeze({
    attemptId: parts.attemptId,
    failureReason: null,
    lease: null,
    providerMessageId: null,
    state: "UNKNOWN",
    stateAt: parts.stateAt,
    unknownReason: parts.unknownReason,
  });
}

function parseActionLifecycle(value: unknown): ActionLifecycle {
  const parts = parseLifecycleParts(value);
  switch (parts.state) {
    case "READY": {
      return parseReadyLifecycle(parts);
    }
    case "IN_FLIGHT": {
      return parseInFlightLifecycle(parts);
    }
    case "CONFIRMED": {
      return parseConfirmedLifecycle(parts);
    }
    case "FAILED": {
      return parseFailedLifecycle(parts);
    }
    case "UNKNOWN": {
      return parseUnknownLifecycle(parts);
    }
    default: {
      throw new ContractValidationError("unsupported action state");
    }
  }
}

export function parseAction(value: unknown): Action {
  const record = expectRecord(value, "action");
  const payload = parseActionPayload(readRequired(record, "payload"));
  const step = parseSequenceStep(readRequired(record, "step"));
  if (payload.step !== step) {
    throw new ContractValidationError(
      "action.step must match action.payload.step"
    );
  }
  const campaignVersionId = parseCampaignVersionId(
    readRequired(record, "campaignVersionId")
  );
  const sourceVersions = parseDraftSourceVersions(
    readRequired(record, "sourceVersions")
  );
  if (sourceVersions.campaign.id !== campaignVersionId) {
    throw new ContractValidationError(
      "action.campaignVersionId must match sourceVersions.campaign.id"
    );
  }
  const base: ActionIdentity = Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    actionId: parseActionId(readRequired(record, "actionId")),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    campaignVersionId,
    createdAt: parseUtcTimestamp(readRequired(record, "createdAt")),
    evidenceIds: expectArrayOf(
      readRequired(record, "evidenceIds"),
      (input) => parseEvidenceId(input),
      "action.evidenceIds",
      20
    ),
    payload,
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    sourceVersions,
    step,
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
  return Object.freeze({ ...base, ...parseActionLifecycle(value) });
}

export function parseActionLifecycleEvent(
  value: unknown
): ActionLifecycleEvent {
  const record = expectRecord(value, "actionEvent");
  const type = member(
    readRequired(record, "type"),
    [
      "ACTION_READY",
      "ACTION_IN_FLIGHT",
      "ACTION_CONFIRMED",
      "ACTION_FAILED",
      "ACTION_UNKNOWN",
    ],
    "actionEvent.type"
  );
  const actionId = parseActionId(readRequired(record, "actionId"));
  const occurredAt = parseUtcTimestamp(readRequired(record, "occurredAt"));

  if (type === "ACTION_READY") {
    return Object.freeze({ actionId, occurredAt, type });
  }
  if (type === "ACTION_IN_FLIGHT") {
    return Object.freeze({
      actionId,
      attemptId: parseSendAttemptId(readRequired(record, "attemptId")),
      fence: expectInteger(
        readRequired(record, "fence"),
        "actionEvent.fence",
        1
      ),
      occurredAt,
      type,
    });
  }
  if (type === "ACTION_CONFIRMED") {
    return Object.freeze({
      actionId,
      attemptId: parseSendAttemptId(readRequired(record, "attemptId")),
      occurredAt,
      providerMessageId: expectNonEmptyString(
        readRequired(record, "providerMessageId"),
        "actionEvent.providerMessageId"
      ),
      type,
    });
  }
  if (type === "ACTION_FAILED") {
    return Object.freeze({
      actionId,
      attemptId: nullable(
        readRequired(record, "attemptId"),
        parseSendAttemptId
      ),
      occurredAt,
      reason: parseActionFailureReason(
        readRequired(record, "reason"),
        "actionEvent.reason"
      ),
      type,
    });
  }
  return Object.freeze({
    actionId,
    attemptId: parseSendAttemptId(readRequired(record, "attemptId")),
    occurredAt,
    reason: parseActionUnknownReason(
      readRequired(record, "reason"),
      "actionEvent.reason"
    ),
    type,
  });
}

function parseEligibilityReasonCode(
  value: unknown,
  path: string
): EligibilityReasonCode {
  return member(value, ELIGIBILITY_REASON_CODES, path);
}

function parseEligibilityReason(
  value: unknown,
  path: string
): EligibilityReason {
  const record = expectRecord(value, path);
  return Object.freeze({
    code: parseEligibilityReasonCode(
      readRequired(record, "code"),
      `${path}.code`
    ),
    detail: expectNullableString(
      readRequired(record, "detail"),
      `${path}.detail`,
      false
    ),
    observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
  });
}

function parseAcceptanceFact(value: unknown): AcceptanceFact {
  const record = expectRecord(value, "eligibility.snapshot.acceptance");
  const accepted = nullable(readRequired(record, "accepted"), (input) =>
    expectBoolean(input, "eligibility.snapshot.acceptance.accepted")
  );
  const observedAt = nullable(
    readRequired(record, "observedAt"),
    parseUtcTimestamp
  );
  if (accepted !== null && observedAt === null) {
    throw new ContractValidationError(
      "known acceptance facts require an observed time"
    );
  }
  return Object.freeze({ accepted, observedAt });
}

function parseEligibilityDraftSnapshot(
  value: unknown
): EligibilityDraftSnapshot {
  const record = expectRecord(value, "eligibility.snapshot.draft");
  const actionId = nullable(readRequired(record, "actionId"), parseActionId);
  const status = member(
    readRequired(record, "status"),
    DRAFT_STATUSES,
    "eligibility.snapshot.draft.status"
  );
  if (status === "VALID" && actionId === null) {
    throw new ContractValidationError(
      "VALID drafts require their stable action ID"
    );
  }
  if (status === "MISSING" && actionId !== null) {
    throw new ContractValidationError(
      "MISSING drafts cannot carry an action ID"
    );
  }
  return Object.freeze({ actionId, status });
}

function parseEligibilityEvidenceSnapshot(
  value: unknown
): EligibilityEvidenceSnapshot {
  const record = expectRecord(value, "eligibility.snapshot.evidence");
  const evidenceIds = expectArrayOf(
    readRequired(record, "evidenceIds"),
    (input) => parseEvidenceId(input),
    "eligibility.snapshot.evidence.evidenceIds",
    20
  );
  const status = member(
    readRequired(record, "status"),
    ELIGIBILITY_FACT_STATUSES,
    "eligibility.snapshot.evidence.status"
  );
  if (status === "VALID" && !isNonEmpty(evidenceIds)) {
    throw new ContractValidationError(
      "VALID evidence snapshots require at least one evidence ID"
    );
  }
  if (status === "MISSING" && evidenceIds.length !== 0) {
    throw new ContractValidationError(
      "MISSING evidence snapshots cannot carry evidence IDs"
    );
  }
  return Object.freeze({ evidenceIds, status });
}

function parseCompletedSequenceSteps(
  value: unknown
): EligibilitySnapshot["completedSteps"] {
  const steps = expectArrayOf(
    value,
    (input) => parseSequenceStep(input),
    "eligibility.snapshot.completedSteps",
    6
  );
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step)) {
      throw new ContractValidationError(
        "eligibility.snapshot.completedSteps cannot repeat a step"
      );
    }
    seen.add(step);
  }
  return steps;
}

function parseEligibilityVersionSnapshot(
  value: unknown
): EligibilityVersionSnapshot {
  const record = expectRecord(value, "eligibility.snapshot.versions");
  return Object.freeze({
    candidate: nullable(
      readRequired(record, "candidate"),
      parseDraftSourceVersions
    ),
    current: parseCurrentVersionSet(readRequired(record, "current")),
  });
}

function parseBusinessWindow(value: unknown, path: string): BusinessWindow {
  const record = expectRecord(value, path);
  const closesAt = parseLocalBusinessTime(
    readRequired(record, "closesAt"),
    `${path}.closesAt`
  );
  const opensAt = parseLocalBusinessTime(
    readRequired(record, "opensAt"),
    `${path}.opensAt`
  );
  if (opensAt >= closesAt) {
    throw new ContractValidationError(
      `${path} must open before it closes on the same local day`
    );
  }
  return Object.freeze({
    closesAt,
    opensAt,
    weekday: parseBusinessWeekday(
      readRequired(record, "weekday"),
      `${path}.weekday`
    ),
  });
}

export function parseBusinessWindowConfiguration(
  value: unknown
): BusinessWindowConfiguration {
  const record = expectRecord(value, "businessWindow");
  const windows = expectArrayOf(
    readRequired(record, "windows"),
    parseBusinessWindow,
    "businessWindow.windows",
    35
  );
  if (!isNonEmpty(windows)) {
    throw new ContractValidationError(
      "businessWindow.windows must contain at least one window"
    );
  }

  for (const [index, window] of windows.entries()) {
    for (const otherWindow of windows.slice(index + 1)) {
      if (
        window.weekday === otherWindow.weekday &&
        window.opensAt < otherWindow.closesAt &&
        otherWindow.opensAt < window.closesAt
      ) {
        throw new ContractValidationError(
          "businessWindow.windows cannot overlap on the same weekday"
        );
      }
    }
  }

  return Object.freeze({
    businessTimeZone: parseBusinessTimeZone(
      readRequired(record, "businessTimeZone")
    ),
    windows,
  });
}

function parseBusinessWindowEvaluation(
  value: unknown
): BusinessWindowEvaluation {
  const record = expectRecord(value, "eligibility.snapshot.businessWindow");
  const status = member(
    readRequired(record, "status"),
    BUSINESS_WINDOW_STATUSES,
    "eligibility.snapshot.businessWindow.status"
  );
  const nextOpenAt = nullable(
    readRequired(record, "nextOpenAt"),
    parseUtcTimestamp
  );
  if (status === "CLOSED") {
    if (nextOpenAt === null) {
      throw new ContractValidationError(
        "CLOSED business windows require the next opening time"
      );
    }
    return Object.freeze({ nextOpenAt, status });
  }
  if (nextOpenAt !== null) {
    throw new ContractValidationError(
      `${status} business windows cannot carry a next opening time`
    );
  }
  if (status === "OPEN") {
    return Object.freeze({ nextOpenAt: null, status });
  }
  return Object.freeze({ nextOpenAt: null, status });
}

export function parseDuePlan(value: unknown): DuePlan {
  const record = expectRecord(value, "duePlan");
  const businessTimeZone = parseBusinessTimeZone(
    readRequired(record, "businessTimeZone")
  );
  const businessWindow = parseBusinessWindowConfiguration(
    readRequired(record, "businessWindow")
  );
  if (businessWindow.businessTimeZone !== businessTimeZone) {
    throw new ContractValidationError(
      "duePlan business timezone must match its window configuration"
    );
  }
  const closureAt = nullable(
    readRequired(record, "closureAt"),
    parseUtcTimestamp
  );
  const earliestAt = parseUtcTimestamp(readRequired(record, "earliestAt"));
  const intendedAt = parseUtcTimestamp(readRequired(record, "intendedAt"));
  if (earliestAt < intendedAt) {
    throw new ContractValidationError(
      "duePlan earliest opportunity cannot precede its intended target"
    );
  }
  if (closureAt !== null && closureAt < earliestAt) {
    throw new ContractValidationError(
      "duePlan closure cannot precede the earliest send opportunity"
    );
  }
  return Object.freeze({
    businessTimeZone,
    businessWindow,
    closureAt,
    earliestAt,
    intendedAt,
    step: parseSequenceStep(readRequired(record, "step")),
  });
}

function parseEligibilitySnapshot(value: unknown): EligibilitySnapshot {
  const record = expectRecord(value, "eligibility.snapshot");
  const draft = parseEligibilityDraftSnapshot(readRequired(record, "draft"));
  const duePlan = nullable(readRequired(record, "duePlan"), parseDuePlan);
  const versions = parseEligibilityVersionSnapshot(
    readRequired(record, "versions")
  );
  if (draft.status === "VALID" && versions.candidate === null) {
    throw new ContractValidationError(
      "VALID eligibility drafts require candidate source versions"
    );
  }
  return Object.freeze({
    acceptance: parseAcceptanceFact(readRequired(record, "acceptance")),
    accountHealthy: nullable(readRequired(record, "accountHealthy"), (input) =>
      expectBoolean(input, "eligibility.snapshot.accountHealthy")
    ),
    businessWindow: nullable(
      readRequired(record, "businessWindow"),
      parseBusinessWindowEvaluation
    ),
    campaignActive: nullable(readRequired(record, "campaignActive"), (input) =>
      expectBoolean(input, "eligibility.snapshot.campaignActive")
    ),
    completedSteps: parseCompletedSequenceSteps(
      readRequired(record, "completedSteps")
    ),
    draft,
    duePlan,
    entitlementActive: nullable(
      readRequired(record, "entitlementActive"),
      (input) => expectBoolean(input, "eligibility.snapshot.entitlementActive")
    ),
    evaluatedAt: parseUtcTimestamp(readRequired(record, "evaluatedAt")),
    evidence: parseEligibilityEvidenceSnapshot(
      readRequired(record, "evidence")
    ),
    incomingMessageAt: nullable(
      readRequired(record, "incomingMessageAt"),
      parseUtcTimestamp
    ),
    ownership: parseOwnership(readRequired(record, "ownership")),
    quotaAvailable: nullable(readRequired(record, "quotaAvailable"), (input) =>
      expectBoolean(input, "eligibility.snapshot.quotaAvailable")
    ),
    suppression: nullable(
      readRequired(record, "suppression"),
      parseSuppressionEntry
    ),
    unresolvedUnknownActionIds: expectArrayOf(
      readRequired(record, "unresolvedUnknownActionIds"),
      (input) => parseActionId(input),
      "eligibility.snapshot.unresolvedUnknownActionIds",
      100
    ),
    versions,
  });
}

export function parseEligibilityCheck(value: unknown): EligibilityCheck {
  const record = expectRecord(value, "eligibilityCheck");
  const accountId = parseAccountId(readRequired(record, "accountId"));
  const campaignId = parseCampaignId(readRequired(record, "campaignId"));
  const prospectId = parseProspectId(readRequired(record, "prospectId"));
  const tenantId = parseTenantId(readRequired(record, "tenantId"));
  const snapshot = parseEligibilitySnapshot(readRequired(record, "snapshot"));
  const step = parseSequenceStep(readRequired(record, "step"));
  if (snapshot.duePlan !== null && snapshot.duePlan.step !== step) {
    throw new ContractValidationError(
      "eligibility step must match the due-plan step"
    );
  }
  if (
    snapshot.suppression !== null &&
    (snapshot.suppression.accountId !== accountId ||
      snapshot.suppression.prospectId !== prospectId ||
      snapshot.suppression.tenantId !== tenantId)
  ) {
    throw new ContractValidationError(
      "eligibility suppression must match its tenant, account and prospect"
    );
  }
  return Object.freeze({
    accountId,
    campaignId,
    prospectId,
    snapshot,
    step,
    tenantId,
  });
}

export function parseEligibilityResult(value: unknown): EligibilityResult {
  const record = expectRecord(value, "eligibilityResult");
  const outcome = member(
    readRequired(record, "outcome"),
    ELIGIBILITY_OUTCOMES,
    "eligibilityResult.outcome"
  );
  const reasons = expectArrayOf(
    readRequired(record, "reasons"),
    parseEligibilityReason,
    "eligibilityResult.reasons",
    20
  );
  const retryAt = nullable(readRequired(record, "retryAt"), parseUtcTimestamp);
  const common = {
    accountId: parseAccountId(readRequired(record, "accountId")),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    evaluatedAt: parseUtcTimestamp(readRequired(record, "evaluatedAt")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    step: parseSequenceStep(readRequired(record, "step")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  };

  if (outcome === "ALLOWED") {
    if (reasons.length !== 0 || retryAt !== null) {
      throw new ContractValidationError(
        "ALLOWED eligibility must have no reasons or retry time"
      );
    }
    const noReasons = [] as const;
    return Object.freeze({
      ...common,
      outcome,
      reasons: noReasons,
      retryAt: null,
    });
  }

  if (!isNonEmpty(reasons)) {
    throw new ContractValidationError(
      `${outcome} eligibility requires a stable reason`
    );
  }
  if (outcome === "HOLD") {
    return Object.freeze({ ...common, outcome, reasons, retryAt });
  }
  if (retryAt !== null) {
    throw new ContractValidationError(
      "DENY eligibility cannot include a retry time"
    );
  }
  return Object.freeze({ ...common, outcome, reasons, retryAt: null });
}

function parseWorkflowSegment(value: string, path: string): string {
  if (value.length === 0) {
    throw new ContractValidationError(`${path} must not be empty`);
  }
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ContractValidationError(`${path} is not URI-encoded`);
  }
}

export function parseWorkflowIdentity(value: unknown): WorkflowIdentity {
  const workflowId = parseWorkflowId(value);
  const [prefix, unit, ...encodedValues] = workflowId.split(":");
  if (prefix !== WORKFLOW_ID_PREFIX || unit === undefined) {
    throw new ContractValidationError(
      "workflowId has an unsupported prefix or unit"
    );
  }
  const values = encodedValues.map((segment, index) =>
    parseWorkflowSegment(segment, `workflowId.segment[${index}]`)
  );

  if (unit === WORKFLOW_UNITS.discoveryBatch && values.length === 3) {
    return Object.freeze({
      batchId: parseBatchId(values[2]),
      campaignId: parseCampaignId(values[1]),
      kind: "DISCOVERY_BATCH",
      tenantId: parseTenantId(values[0]),
    });
  }
  if (unit === WORKFLOW_UNITS.prospectSequence && values.length === 4) {
    return Object.freeze({
      accountId: parseAccountId(values[1]),
      campaignId: parseCampaignId(values[3]),
      kind: "PROSPECT_SEQUENCE",
      prospectId: parseProspectId(values[2]),
      tenantId: parseTenantId(values[0]),
    });
  }
  if (unit === WORKFLOW_UNITS.accountReconciliation && values.length === 2) {
    return Object.freeze({
      accountId: parseAccountId(values[1]),
      kind: "ACCOUNT_RECONCILIATION",
      tenantId: parseTenantId(values[0]),
    });
  }
  if (unit === WORKFLOW_UNITS.campaignCoordinator && values.length === 2) {
    return Object.freeze({
      campaignId: parseCampaignId(values[1]),
      kind: "CAMPAIGN_COORDINATOR",
      tenantId: parseTenantId(values[0]),
    });
  }
  if (unit === WORKFLOW_UNITS.outboxDelivery && values.length === 2) {
    return Object.freeze({
      kind: "OUTBOX_DELIVERY",
      outboxEventId: parseOutboxEventId(values[1]),
      tenantId: parseTenantId(values[0]),
    });
  }
  throw new ContractValidationError(
    "workflowId has the wrong number of scope segments"
  );
}

function parseLimit(value: unknown, path: string): number {
  return expectInteger(value, path, 1, 100);
}

function parseNonNegativeCount(value: unknown, path: string): number {
  return expectInteger(value, path, 0, 100_000);
}

function parseActivityInputFor(
  name: WorkflowActivityName,
  value: unknown
): WorkflowActivityInput<WorkflowActivityName> {
  const record = expectRecord(value, `activity.${name}.input`);
  switch (name) {
    case WORKFLOW_ACTIVITY_NAMES.discoveryFetchPage: {
      return Object.freeze({
        batchId: parseBatchId(readRequired(record, "batchId")),
        campaignId: parseCampaignId(readRequired(record, "campaignId")),
        campaignVersionId: parseCampaignVersionId(
          readRequired(record, "campaignVersionId")
        ),
        cursor: cursor(
          readRequired(record, "cursor"),
          "activity.discovery.fetch_page.cursor"
        ),
        limit: parseLimit(
          readRequired(record, "limit"),
          "activity.discovery.fetch_page.limit"
        ),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch: {
      return Object.freeze({
        campaignId: parseCampaignId(readRequired(record, "campaignId")),
        campaignVersionId: parseCampaignVersionId(
          readRequired(record, "campaignVersionId")
        ),
        prospectIds: expectArrayOf(
          readRequired(record, "prospectIds"),
          (input) => parseProspectId(input),
          "activity.discovery.qualify_batch.prospectIds",
          100
        ),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceReadState: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        campaignId: parseCampaignId(readRequired(record, "campaignId")),
        prospectId: parseProspectId(readRequired(record, "prospectId")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceCheckAcceptance: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        prospectId: parseProspectId(readRequired(record, "prospectId")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceDispatchAction: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        actionId: parseActionId(readRequired(record, "actionId")),
        attemptId: parseSendAttemptId(readRequired(record, "attemptId")),
        campaignVersionId: parseCampaignVersionId(
          readRequired(record, "campaignVersionId")
        ),
        fence: expectInteger(
          readRequired(record, "fence"),
          "activity.sequence.dispatch_action.fence",
          1
        ),
        prospectId: parseProspectId(readRequired(record, "prospectId")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceDraftAction: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        campaignId: parseCampaignId(readRequired(record, "campaignId")),
        campaignVersionId: parseCampaignVersionId(
          readRequired(record, "campaignVersionId")
        ),
        evidenceIds: expectArrayOf(
          readRequired(record, "evidenceIds"),
          (input) => parseEvidenceId(input),
          "activity.sequence.draft_action.evidenceIds",
          20
        ),
        prospectId: parseProspectId(readRequired(record, "prospectId")),
        step: parseSequenceStep(readRequired(record, "step")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceReconcileAction: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        actionId: parseActionId(readRequired(record, "actionId")),
        prospectId: parseProspectId(readRequired(record, "prospectId")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.accountReconcile: {
      return Object.freeze({
        accountId: parseAccountId(readRequired(record, "accountId")),
        cursor: cursor(
          readRequired(record, "cursor"),
          "activity.account.reconcile.cursor"
        ),
        maxMessages: parseLimit(
          readRequired(record, "maxMessages"),
          "activity.account.reconcile.maxMessages"
        ),
        requestedAt: parseUtcTimestamp(readRequired(record, "requestedAt")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.campaignCoordinate: {
      return Object.freeze({
        batchLimit: parseLimit(
          readRequired(record, "batchLimit"),
          "activity.campaign.coordinate.batchLimit"
        ),
        campaignId: parseCampaignId(readRequired(record, "campaignId")),
        campaignVersionId: parseCampaignVersionId(
          readRequired(record, "campaignVersionId")
        ),
        dueAt: parseUtcTimestamp(readRequired(record, "dueAt")),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.outboxDeliver: {
      return Object.freeze({
        attempt: expectInteger(
          readRequired(record, "attempt"),
          "activity.outbox.deliver.attempt",
          1
        ),
        eventId: parseOutboxEventId(readRequired(record, "eventId")),
        eventKind: member(
          readRequired(record, "eventKind"),
          OUTBOX_EVENT_KINDS,
          "activity.outbox.deliver.eventKind"
        ),
        requestedAt: parseUtcTimestamp(readRequired(record, "requestedAt")),
        targetWorkflowId: nullable(
          readRequired(record, "targetWorkflowId"),
          parseWorkflowId
        ),
        tenantId: parseTenantId(readRequired(record, "tenantId")),
      });
    }
    default: {
      throw new ContractValidationError("unsupported activity input");
    }
  }
}

export function parseActivityInput<Name extends WorkflowActivityName>(
  name: Name,
  value: unknown
): WorkflowActivityInput<Name>;
export function parseActivityInput(
  name: WorkflowActivityName,
  value: unknown
): WorkflowActivityInput<WorkflowActivityName> {
  return parseActivityInputFor(name, value);
}

function parseDiscoveryQualification(
  value: unknown,
  path: string
): DiscoveryQualification {
  const record = expectRecord(value, path);
  const evidenceIds = expectArrayOf(
    readRequired(record, "evidenceIds"),
    (input) => parseEvidenceId(input),
    `${path}.evidenceIds`,
    20
  );
  const outcome = member(
    readRequired(record, "outcome"),
    ["HOLD", "QUALIFIED", "SKIP"],
    `${path}.outcome`
  );
  const prospectId = parseProspectId(readRequired(record, "prospectId"));
  const reason = nullable(readRequired(record, "reason"), (input) =>
    parseEligibilityReasonCode(input, `${path}.reason`)
  );

  if (outcome === "QUALIFIED") {
    if (!isNonEmpty(evidenceIds) || reason !== null) {
      throw new ContractValidationError(
        "QUALIFIED discovery results require evidence and a null reason"
      );
    }
    return Object.freeze({ evidenceIds, outcome, prospectId, reason: null });
  }
  if (reason === null) {
    throw new ContractValidationError(
      `${outcome} discovery results require a stable reason`
    );
  }
  if (outcome === "HOLD") {
    return Object.freeze({ evidenceIds, outcome, prospectId, reason });
  }
  return Object.freeze({
    evidenceIds,
    outcome,
    prospectId,
    reason,
  });
}

function validateReconciliationResult(
  outcome: "CONFIRMED" | "NOT_FOUND" | "UNKNOWN",
  providerMessageId: string | null,
  unknownReason: ActionUnknownReason | null
): void {
  if (outcome === "CONFIRMED") {
    if (providerMessageId === null || unknownReason !== null) {
      throw new ContractValidationError(
        "confirmed reconciliation requires a provider message ID"
      );
    }
    return;
  }
  if (outcome === "NOT_FOUND") {
    if (providerMessageId !== null || unknownReason !== null) {
      throw new ContractValidationError(
        "not-found reconciliation cannot be uncertain"
      );
    }
    return;
  }
  if (providerMessageId !== null || unknownReason === null) {
    throw new ContractValidationError(
      "unknown reconciliation requires an explicit uncertainty reason"
    );
  }
}

function parseSequenceDispatchActionResult(
  record: Record<string, unknown>
): SequenceDispatchActionResult {
  const outcome = member(
    readRequired(record, "outcome"),
    ["CONFIRMED", "FAILED", "UNKNOWN"],
    "activity.sequence.dispatch_action.outcome"
  );
  const actionId = parseActionId(readRequired(record, "actionId"));
  const attemptId = parseSendAttemptId(readRequired(record, "attemptId"));
  const completedAt = parseUtcTimestamp(readRequired(record, "completedAt"));

  if (outcome === "CONFIRMED") {
    const reason = readRequired(record, "reason");
    if (!isNull(reason)) {
      throw new ContractValidationError(
        "CONFIRMED dispatch results require a null reason"
      );
    }
    return Object.freeze({
      actionId,
      attemptId,
      completedAt,
      outcome,
      providerMessageId: expectNonEmptyString(
        readRequired(record, "providerMessageId"),
        "activity.sequence.dispatch_action.providerMessageId"
      ),
      reason: null,
    });
  }

  const providerMessageId = nullableNonEmptyString(
    readRequired(record, "providerMessageId"),
    "activity.sequence.dispatch_action.providerMessageId"
  );
  if (providerMessageId !== null) {
    throw new ContractValidationError(
      `${outcome} dispatch results cannot carry a provider message ID`
    );
  }
  if (outcome === "FAILED") {
    return Object.freeze({
      actionId,
      attemptId,
      completedAt,
      outcome,
      providerMessageId: null,
      reason: parseActionFailureReason(
        readRequired(record, "reason"),
        "activity.sequence.dispatch_action.reason"
      ),
    });
  }
  return Object.freeze({
    actionId,
    attemptId,
    completedAt,
    outcome,
    providerMessageId: null,
    reason: parseActionUnknownReason(
      readRequired(record, "reason"),
      "activity.sequence.dispatch_action.reason"
    ),
  });
}

function parseSequenceDraftActionResult(
  record: Record<string, unknown>
): SequenceDraftActionResult {
  const outcome = member(
    readRequired(record, "outcome"),
    ["DRAFTED", "HOLD"],
    "activity.sequence.draft_action.outcome"
  );
  const actionId = nullable(readRequired(record, "actionId"), parseActionId);
  const observedAt = parseUtcTimestamp(readRequired(record, "observedAt"));
  const reason = nullable(readRequired(record, "reason"), (input) =>
    parseEligibilityReasonCode(input, "activity.sequence.draft_action.reason")
  );
  const sourceVersions = nullable(
    readRequired(record, "sourceVersions"),
    parseDraftSourceVersions
  );

  if (outcome === "DRAFTED") {
    if (actionId === null || sourceVersions === null || reason !== null) {
      throw new ContractValidationError(
        "DRAFTED results require an action, source versions and a null reason"
      );
    }
    return Object.freeze({
      actionId,
      observedAt,
      outcome,
      reason: null,
      sourceVersions,
    });
  }
  if (actionId !== null || sourceVersions !== null || reason === null) {
    throw new ContractValidationError(
      "HOLD draft results require a reason and no action or source versions"
    );
  }
  return Object.freeze({
    actionId: null,
    observedAt,
    outcome,
    reason,
    sourceVersions: null,
  });
}

function parseActivityResultFor(
  name: WorkflowActivityName,
  value: unknown
): WorkflowActivityResult<WorkflowActivityName> {
  const record = expectRecord(value, `activity.${name}.result`);
  switch (name) {
    case WORKFLOW_ACTIVITY_NAMES.discoveryFetchPage: {
      return Object.freeze({
        candidateProspectIds: expectArrayOf(
          readRequired(record, "candidateProspectIds"),
          (input) => parseProspectId(input),
          "activity.discovery.fetch_page.candidateProspectIds",
          100
        ),
        exhausted: expectBoolean(
          readRequired(record, "exhausted"),
          "activity.discovery.fetch_page.exhausted"
        ),
        nextCursor: cursor(
          readRequired(record, "nextCursor"),
          "activity.discovery.fetch_page.nextCursor"
        ),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.discoveryQualifyBatch: {
      return Object.freeze({
        decisions: expectArrayOf(
          readRequired(record, "decisions"),
          parseDiscoveryQualification,
          "activity.discovery.qualify_batch.decisions",
          100
        ),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceReadState: {
      return Object.freeze({
        campaignVersionId: nullable(
          readRequired(record, "campaignVersionId"),
          parseCampaignVersionId
        ),
        lastIncomingAt: nullable(
          readRequired(record, "lastIncomingAt"),
          parseUtcTimestamp
        ),
        latestActionId: nullable(
          readRequired(record, "latestActionId"),
          parseActionId
        ),
        nextStep: nullable(readRequired(record, "nextStep"), parseSequenceStep),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
        ownership: parseOwnership(readRequired(record, "ownership")),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceCheckAcceptance: {
      return Object.freeze({
        accepted: nullable(readRequired(record, "accepted"), (input) =>
          expectBoolean(input, "activity.sequence.check_acceptance.accepted")
        ),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
        source: member(
          readRequired(record, "source"),
          ["PROVIDER_EVENT", "PROVIDER_HISTORY", "UNKNOWN"],
          "activity.sequence.check_acceptance.source"
        ),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceDispatchAction: {
      return parseSequenceDispatchActionResult(record);
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceDraftAction: {
      return parseSequenceDraftActionResult(record);
    }
    case WORKFLOW_ACTIVITY_NAMES.sequenceReconcileAction: {
      const outcome = member(
        readRequired(record, "outcome"),
        ["CONFIRMED", "NOT_FOUND", "UNKNOWN"],
        "activity.sequence.reconcile_action.outcome"
      );
      const providerMessageId = nullableNonEmptyString(
        readRequired(record, "providerMessageId"),
        "activity.sequence.reconcile_action.providerMessageId"
      );
      const unknownReason = nullable(
        readRequired(record, "unknownReason"),
        (input) =>
          parseActionUnknownReason(
            input,
            "activity.sequence.reconcile_action.unknownReason"
          )
      );
      validateReconciliationResult(outcome, providerMessageId, unknownReason);
      return Object.freeze({
        outcome,
        providerMessageId,
        reconciledAt: parseUtcTimestamp(readRequired(record, "reconciledAt")),
        unknownReason,
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.accountReconcile: {
      return Object.freeze({
        accountHealthy: nullable(
          readRequired(record, "accountHealthy"),
          (input) =>
            expectBoolean(input, "activity.account.reconcile.accountHealthy")
        ),
        completed: expectBoolean(
          readRequired(record, "completed"),
          "activity.account.reconcile.completed"
        ),
        incomingMessagesFound: parseNonNegativeCount(
          readRequired(record, "incomingMessagesFound"),
          "activity.account.reconcile.incomingMessagesFound"
        ),
        nextCursor: cursor(
          readRequired(record, "nextCursor"),
          "activity.account.reconcile.nextCursor"
        ),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
        unresolvedActionIds: expectArrayOf(
          readRequired(record, "unresolvedActionIds"),
          (input) => parseActionId(input),
          "activity.account.reconcile.unresolvedActionIds",
          100
        ),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.campaignCoordinate: {
      return Object.freeze({
        heldProspectIds: expectArrayOf(
          readRequired(record, "heldProspectIds"),
          (input) => parseProspectId(input),
          "activity.campaign.coordinate.heldProspectIds",
          100
        ),
        observedAt: parseUtcTimestamp(readRequired(record, "observedAt")),
        remainingCount: parseNonNegativeCount(
          readRequired(record, "remainingCount"),
          "activity.campaign.coordinate.remainingCount"
        ),
        startedProspectIds: expectArrayOf(
          readRequired(record, "startedProspectIds"),
          (input) => parseProspectId(input),
          "activity.campaign.coordinate.startedProspectIds",
          100
        ),
      });
    }
    case WORKFLOW_ACTIVITY_NAMES.outboxDeliver: {
      const outcome = member(
        readRequired(record, "outcome"),
        ["DELIVERED", "IGNORED_COMPLETED", "QUARANTINED", "RETRY"],
        "activity.outbox.deliver.outcome"
      );
      const nextAttemptAt = nullable(
        readRequired(record, "nextAttemptAt"),
        parseUtcTimestamp
      );
      if (outcome === "RETRY" && nextAttemptAt === null) {
        throw new ContractValidationError(
          "RETRY outbox results require nextAttemptAt"
        );
      }
      if (outcome !== "RETRY" && nextAttemptAt !== null) {
        throw new ContractValidationError(
          "terminal outbox results cannot carry nextAttemptAt"
        );
      }
      return Object.freeze({
        deliveredAt: parseUtcTimestamp(readRequired(record, "deliveredAt")),
        nextAttemptAt,
        outcome,
      });
    }
    default: {
      throw new ContractValidationError("unsupported activity result");
    }
  }
}

export function parseActivityResult<Name extends WorkflowActivityName>(
  name: Name,
  value: unknown
): WorkflowActivityResult<Name>;
export function parseActivityResult(
  name: WorkflowActivityName,
  value: unknown
): WorkflowActivityResult<WorkflowActivityName> {
  return parseActivityResultFor(name, value);
}

function pauseReason(value: unknown, path: string) {
  return member(value, WORKFLOW_PAUSE_REASONS, path);
}

export function parseWorkflowSignal(value: unknown): WorkflowSignal {
  const record = expectRecord(value, "workflowSignal");
  const name = member(
    readRequired(record, "name"),
    [
      WORKFLOW_SIGNAL_NAMES.discoveryCancel,
      WORKFLOW_SIGNAL_NAMES.discoveryPause,
      WORKFLOW_SIGNAL_NAMES.accountReconcileNow,
      WORKFLOW_SIGNAL_NAMES.campaignAccountChanged,
      WORKFLOW_SIGNAL_NAMES.campaignPause,
      WORKFLOW_SIGNAL_NAMES.outboxRetry,
      WORKFLOW_SIGNAL_NAMES.sequenceAcceptanceObserved,
      WORKFLOW_SIGNAL_NAMES.sequenceIncomingMessage,
      WORKFLOW_SIGNAL_NAMES.sequenceStop,
    ],
    "workflowSignal.name"
  );
  const at = parseUtcTimestamp(readRequired(record, "at"));

  if (
    name === WORKFLOW_SIGNAL_NAMES.discoveryCancel ||
    name === WORKFLOW_SIGNAL_NAMES.discoveryPause
  ) {
    return Object.freeze({
      at,
      batchId: parseBatchId(readRequired(record, "batchId")),
      name,
      reason: pauseReason(
        readRequired(record, "reason"),
        "workflowSignal.reason"
      ),
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.accountReconcileNow) {
    return Object.freeze({
      accountId: parseAccountId(readRequired(record, "accountId")),
      at,
      name,
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.campaignAccountChanged) {
    return Object.freeze({
      accountId: parseAccountId(readRequired(record, "accountId")),
      at,
      name,
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.campaignPause) {
    return Object.freeze({
      at,
      campaignId: parseCampaignId(readRequired(record, "campaignId")),
      name,
      reason: pauseReason(
        readRequired(record, "reason"),
        "workflowSignal.reason"
      ),
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.outboxRetry) {
    return Object.freeze({
      at,
      eventId: parseOutboxEventId(readRequired(record, "eventId")),
      name,
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.sequenceAcceptanceObserved) {
    return Object.freeze({
      accepted: nullable(readRequired(record, "accepted"), (input) =>
        expectBoolean(input, "workflowSignal.accepted")
      ),
      at,
      name,
    });
  }
  if (name === WORKFLOW_SIGNAL_NAMES.sequenceIncomingMessage) {
    return Object.freeze({
      at,
      messageId: parseMessageId(readRequired(record, "messageId")),
      name,
    });
  }
  return Object.freeze({
    at,
    name,
    reason: parseOwnershipReason(
      readRequired(record, "reason"),
      "workflowSignal.reason"
    ),
  });
}

export function safeParseAction(value: unknown): SafeParseResult<Action> {
  return safeParse(parseAction, value);
}

export function safeParseMessage(value: unknown): SafeParseResult<Message> {
  return safeParse(parseMessage, value);
}

export function safeParseEvidence(value: unknown): SafeParseResult<Evidence> {
  return safeParse(parseEvidence, value);
}

export function safeParseWorkflowSignal(
  value: unknown
): SafeParseResult<WorkflowSignal> {
  return safeParse(parseWorkflowSignal, value);
}

export type ParsedContract =
  | Action
  | AccountProspectOwnership
  | Evidence
  | EligibilityCheck
  | EligibilityResult
  | IncomingMessageEvent
  | Message
  | SuppressionEntry
  | WorkflowSignal;

export type ParsedActivityInput = WorkflowActivityInput<WorkflowActivityName>;
export type ParsedActivityResult = WorkflowActivityResult<WorkflowActivityName>;
