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
import { ELIGIBILITY_OUTCOMES, ELIGIBILITY_REASON_CODES } from "./eligibility";
import type {
  EligibilityCheck,
  EligibilityReason,
  EligibilityReasonCode,
  EligibilityResult,
  EligibilitySnapshot,
} from "./eligibility";
import { EVIDENCE_PROVENANCE } from "./evidence";
import type { Evidence, EvidenceProvenance } from "./evidence";
import {
  parseAccountId,
  parseActionId,
  parseBatchId,
  parseCampaignId,
  parseCampaignVersionId,
  parseConversationId,
  parseEvidenceId,
  parseMessageId,
  parseModelVersion as parseModelVersionId,
  parseOutboxEventId,
  parseProspectId,
  parseSendAttemptId,
  parseTenantId,
  parseUserId,
  parseVersionId,
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
  OWNERSHIP_KINDS,
  OWNERSHIP_REASONS,
  SUPPRESSION_REASONS,
} from "./ownership";
import type {
  AccountProspectOwnership,
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
  parseBusinessTimeZone,
  parseDirectMessageStep,
  parseSequenceStep,
  parseUtcTimestamp,
} from "./values";
import { VERSION_KINDS } from "./versions";
import type { DraftSourceVersions, VersionKind, VersionRef } from "./versions";
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
  return Object.freeze({
    createdAt: parseUtcTimestamp(readRequired(record, "createdAt")),
    id: parseVersionId(readRequired(record, "id")),
    kind: member(readRequired(record, "kind"), VERSION_KINDS, `${path}.kind`),
    revision: expectInteger(
      readRequired(record, "revision"),
      `${path}.revision`,
      1
    ),
  });
}

function versionOfKind(
  value: unknown,
  path: string,
  kind: VersionKind
): VersionRef {
  const parsed = parseVersionRef(value, path);
  if (parsed.kind !== kind) {
    throw new ContractValidationError(`${path}.kind must be ${kind}`);
  }
  return parsed;
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
  });
}

function parseOwnershipReason(value: unknown, path: string): OwnershipReason {
  return member(value, OWNERSHIP_REASONS, path);
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
  const common = {
    reason: parseOwnershipReason(
      readRequired(record, "reason"),
      "ownership.reason"
    ),
    recordedAt: parseUtcTimestamp(readRequired(record, "recordedAt")),
  };

  if (kind === "BOT_ELIGIBLE") {
    if (ownerUserId !== null) {
      throw new ContractValidationError(
        "BOT_ELIGIBLE ownership cannot name a human owner"
      );
    }
    return Object.freeze({
      ...common,
      kind,
      ownerUserId: null,
    });
  }

  return Object.freeze({
    ...common,
    kind,
    ownerUserId,
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

export function parseEvidence(value: unknown): Evidence {
  const record = expectRecord(value, "evidence");
  return Object.freeze({
    accountId: nullable(readRequired(record, "accountId"), parseAccountId),
    capturedAt: parseUtcTimestamp(readRequired(record, "capturedAt")),
    contentHash: nullableNonEmptyString(
      readRequired(record, "contentHash"),
      "evidence.contentHash"
    ),
    evidenceId: parseEvidenceId(readRequired(record, "evidenceId")),
    normalizedClaim: expectNonEmptyString(
      readRequired(record, "normalizedClaim"),
      "evidence.normalizedClaim"
    ),
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
  const base: ActionIdentity = Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    actionId: parseActionId(readRequired(record, "actionId")),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    campaignVersionId: parseCampaignVersionId(
      readRequired(record, "campaignVersionId")
    ),
    createdAt: parseUtcTimestamp(readRequired(record, "createdAt")),
    evidenceIds: expectArrayOf(
      readRequired(record, "evidenceIds"),
      (input) => parseEvidenceId(input),
      "action.evidenceIds",
      20
    ),
    payload,
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    sourceVersions: parseDraftSourceVersions(
      readRequired(record, "sourceVersions")
    ),
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

function parseEligibilitySnapshot(value: unknown): EligibilitySnapshot {
  const record = expectRecord(value, "eligibility.snapshot");
  return Object.freeze({
    accountHealthy: nullable(readRequired(record, "accountHealthy"), (input) =>
      expectBoolean(input, "eligibility.snapshot.accountHealthy")
    ),
    campaignActive: nullable(readRequired(record, "campaignActive"), (input) =>
      expectBoolean(input, "eligibility.snapshot.campaignActive")
    ),
    currentCampaignVersionId: nullable(
      readRequired(record, "currentCampaignVersionId"),
      parseVersionId
    ),
    entitlementActive: nullable(
      readRequired(record, "entitlementActive"),
      (input) => expectBoolean(input, "eligibility.snapshot.entitlementActive")
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
  });
}

export function parseEligibilityCheck(value: unknown): EligibilityCheck {
  const record = expectRecord(value, "eligibilityCheck");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    snapshot: parseEligibilitySnapshot(readRequired(record, "snapshot")),
    step: parseSequenceStep(readRequired(record, "step")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
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

export function parseDuePlan(value: unknown): DuePlan {
  const record = expectRecord(value, "duePlan");
  return Object.freeze({
    businessTimeZone: parseBusinessTimeZone(
      readRequired(record, "businessTimeZone")
    ),
    closureAt: nullable(readRequired(record, "closureAt"), parseUtcTimestamp),
    earliestAt: parseUtcTimestamp(readRequired(record, "earliestAt")),
    intendedAt: parseUtcTimestamp(readRequired(record, "intendedAt")),
    step: parseSequenceStep(readRequired(record, "step")),
  });
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
  return Object.freeze({
    evidenceIds: expectArrayOf(
      readRequired(record, "evidenceIds"),
      (input) => parseEvidenceId(input),
      `${path}.evidenceIds`,
      20
    ),
    outcome: member(
      readRequired(record, "outcome"),
      ["HOLD", "QUALIFIED", "SKIP"],
      `${path}.outcome`
    ),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    reason: nullable(readRequired(record, "reason"), (input) =>
      parseEligibilityReasonCode(input, `${path}.reason`)
    ),
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
