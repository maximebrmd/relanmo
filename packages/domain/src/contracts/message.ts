import type {
  AccountId,
  ConversationId,
  MessageId,
  ProspectId,
  TenantId,
} from "./ids";
import type { UtcTimestamp } from "./values";

export const ATTACHMENT_KINDS = [
  "IMAGE",
  "FILE",
  "VIDEO",
  "AUDIO",
  "OTHER",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type Attachment = Readonly<{
  contentType: string | null;
  kind: AttachmentKind;
  name: string | null;
  providerAttachmentId: string | null;
  sizeBytes: number | null;
  url: string | null;
}>;

export const MESSAGE_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_ACTORS = ["PROSPECT", "BOT", "OWNER", "UNKNOWN"] as const;
export type MessageActor = (typeof MESSAGE_ACTORS)[number];

export const MESSAGE_SOURCES = [
  "PROVIDER_EVENT",
  "PROVIDER_HISTORY",
  "SEND_LEDGER",
] as const;
export type MessageSource = (typeof MESSAGE_SOURCES)[number];

export type MessageBase = Readonly<{
  accountId: AccountId;
  attachments: readonly Attachment[];
  conversationId: ConversationId;
  messageId: MessageId;
  occurredAt: UtcTimestamp;
  prospectId: ProspectId;
  providerMessageId: string | null;
  receivedAt: UtcTimestamp;
  source: MessageSource;
  tenantId: TenantId;
  text: string | null;
}>;

export type InboundMessage = Readonly<
  MessageBase & {
    actor: "PROSPECT" | "UNKNOWN";
    direction: "INBOUND";
  }
>;

export type OutboundMessage = Readonly<
  MessageBase & {
    actor: "BOT" | "OWNER" | "UNKNOWN";
    direction: "OUTBOUND";
  }
>;

export type Message = InboundMessage | OutboundMessage;

export type IncomingMessageEvent = Readonly<{
  dedupeKey: string;
  message: InboundMessage;
  receivedAt: UtcTimestamp;
  type: "INCOMING_MESSAGE";
}>;
