/* oxlint-disable anti-slop/no-unknown-parameters -- ID parsers are explicit untrusted-input boundaries. */

import {
  ContractValidationError,
  expectString,
  isMember,
  parseOpaqueString,
} from "./runtime.js";

export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">;
export type AccountId = Brand<string, "AccountId">;
export type ProspectId = Brand<string, "ProspectId">;
export type ConversationId = Brand<string, "ConversationId">;
export type CampaignId = Brand<string, "CampaignId">;
export type VersionId = Brand<string, "VersionId">;
export type CampaignVersionId = Brand<string, "CampaignVersionId">;
export type ActionId = Brand<string, "ActionId">;
export type SendAttemptId = Brand<string, "SendAttemptId">;
export type MessageId = Brand<string, "MessageId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type WorkflowId = Brand<string, "WorkflowId">;
export type BatchId = Brand<string, "BatchId">;
export type OutboxEventId = Brand<string, "OutboxEventId">;
export type ModelVersion = Brand<string, "ModelVersion">;

function brand<Id extends string>(value: string): Id {
  // SAFETY: The caller has already validated the opaque identifier at this boundary.
  return value as Id;
}

function parseId<Id extends string>(value: unknown, path: string): Id {
  return brand<Id>(parseOpaqueString(value, path));
}

export function parseTenantId(value: unknown): TenantId {
  return parseId<TenantId>(value, "tenantId");
}

export function parseUserId(value: unknown): UserId {
  return parseId<UserId>(value, "userId");
}

export function parseAccountId(value: unknown): AccountId {
  return parseId<AccountId>(value, "accountId");
}

export function parseProspectId(value: unknown): ProspectId {
  return parseId<ProspectId>(value, "prospectId");
}

export function parseConversationId(value: unknown): ConversationId {
  return parseId<ConversationId>(value, "conversationId");
}

export function parseCampaignId(value: unknown): CampaignId {
  return parseId<CampaignId>(value, "campaignId");
}

export function parseVersionId(value: unknown): VersionId {
  return parseId<VersionId>(value, "versionId");
}

export function parseCampaignVersionId(value: unknown): CampaignVersionId {
  return parseId<CampaignVersionId>(value, "campaignVersionId");
}

export function parseActionId(value: unknown): ActionId {
  return parseId<ActionId>(value, "actionId");
}

export function parseSendAttemptId(value: unknown): SendAttemptId {
  return parseId<SendAttemptId>(value, "attemptId");
}

export function parseMessageId(value: unknown): MessageId {
  return parseId<MessageId>(value, "messageId");
}

export function parseEvidenceId(value: unknown): EvidenceId {
  return parseId<EvidenceId>(value, "evidenceId");
}

export function parseBatchId(value: unknown): BatchId {
  return parseId<BatchId>(value, "batchId");
}

export function parseOutboxEventId(value: unknown): OutboxEventId {
  return parseId<OutboxEventId>(value, "outboxEventId");
}

export function parseModelVersion(value: unknown): ModelVersion {
  return brand<ModelVersion>(parseOpaqueString(value, "modelVersion"));
}

export function parseWorkflowId(value: unknown): WorkflowId {
  const parsed = expectString(value, "workflowId");
  const [prefix, unit] = parsed.split(":");
  if (
    parsed.length === 0 ||
    parsed.length > 240 ||
    /\s/u.test(parsed) ||
    prefix !== "rlm1" ||
    unit === undefined ||
    !isMember(unit, ["a", "c", "d", "o", "s"] as const)
  ) {
    throw new ContractValidationError(
      "workflowId must use the canonical compact Relanmo prefix and unit"
    );
  }
  // SAFETY: Length and whitespace are validated before branding a workflow identity.
  return parsed as WorkflowId;
}
