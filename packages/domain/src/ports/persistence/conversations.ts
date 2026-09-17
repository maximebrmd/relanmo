import type {
  AccountId,
  ConversationId,
  MessageId,
  ProspectId,
  TenantId,
} from "../../contracts/ids";
import type { Message } from "../../contracts/message";
import type { Ownership } from "../../contracts/ownership";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  AccountProspectKey,
  PersistenceResult,
  PersistenceTransaction,
} from "./common";

export const CONVERSATION_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type ConversationRecord = Readonly<{
  accountId: AccountId;
  conversationId: ConversationId;
  createdAt: UtcTimestamp;
  humanOwnedAt: UtcTimestamp | null;
  lastIncomingAt: UtcTimestamp | null;
  lastMessageAt: UtcTimestamp | null;
  ownership: Ownership;
  prospectId: ProspectId;
  status: ConversationStatus;
  tenantId: TenantId;
  updatedAt: UtcTimestamp;
}>;

export type StoredMessage = Readonly<{
  dedupeKey: string | null;
  message: Message;
  recordedAt: UtcTimestamp;
}>;

export type GetConversationInput = AccountProspectKey;

export type GetConversationResult = Readonly<{
  conversation: ConversationRecord | null;
}>;

export type GetHistoryInput = Readonly<
  AccountProspectKey & {
    conversationId: ConversationId;
    cursor: string | null;
    limit: number;
  }
>;

export type GetHistoryResult = Readonly<{
  conversation: ConversationRecord | null;
  messages: readonly StoredMessage[];
  nextCursor: string | null;
}>;

export type RecordMessageInput = Readonly<{
  dedupeKey: string | null;
  message: Message;
  recordedAt: UtcTimestamp;
}>;

export type RecordMessageResult =
  | Readonly<{
      conversation: ConversationRecord;
      message: StoredMessage;
      outcome: "RECORDED";
    }>
  | Readonly<{
      conversation: ConversationRecord;
      existingMessageId: MessageId;
      message: StoredMessage;
      outcome: "DUPLICATE";
    }>;

/** Conversation reads expose ownership and history without provider payloads. */
export interface ConversationRepository {
  get: (
    input: GetConversationInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetConversationResult>>;
  getHistory: (
    input: GetHistoryInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<GetHistoryResult>>;
}

/** Message identity is deduplicated before any model or writing operation is called. */
export interface MessageRepository {
  record: (
    input: RecordMessageInput,
    tx: PersistenceTransaction
  ) => Promise<PersistenceResult<RecordMessageResult>>;
}
