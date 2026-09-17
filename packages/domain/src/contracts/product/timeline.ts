import type { ActionUnknownReason } from "../action";
import type {
  AccountId,
  ConversationId,
  MessageId,
  ProspectId,
  TenantId,
} from "../ids";
import type {
  MessageActor,
  MessageDirection,
  MessageSource,
  AttachmentKind,
} from "../message";
import type { OwnershipKind } from "../ownership";
import type { DirectMessageStep, UtcTimestamp } from "../values";
import type {
  ConversationSelector,
  PageRequest,
  ProductPage,
  ProductPauseReason,
  ProductViewState,
} from "./common";

export type TimelineAttachmentView = Readonly<{
  contentType: string | null;
  kind: AttachmentKind;
  name: string | null;
  sizeBytes: number | null;
}>;

export type TimelineMessageView = Readonly<{
  actor: MessageActor;
  attachments: readonly TimelineAttachmentView[];
  direction: MessageDirection;
  messageId: MessageId;
  occurredAt: UtcTimestamp;
  receivedAt: UtcTimestamp;
  source: MessageSource;
  text: string | null;
}>;

export type ConversationHandoverView = Readonly<{
  instruction: "REPLY_IN_LINKEDIN";
  required: boolean;
  reason:
    | "INCOMING_MESSAGE"
    | "IMPORTED_MANUAL_CONVERSATION"
    | "MANUAL_REPLY"
    | "UNMATCHED_OUTGOING_MESSAGE";
}>;

export type TimelineUnknownOutcomeView = Readonly<{
  occurredAt: UtcTimestamp;
  reason: ActionUnknownReason;
  step: DirectMessageStep;
}>;

export const TIMELINE_AUTOMATION_STATES = [
  "ACTIVE",
  "PAUSED",
  "HUMAN_HANDOVER",
  "UNKNOWN",
] as const;
export type TimelineAutomationState =
  (typeof TIMELINE_AUTOMATION_STATES)[number];

export type ConversationTimelineView = Readonly<{
  accountId: AccountId;
  automation: TimelineAutomationState;
  conversationId: ConversationId;
  handover: ConversationHandoverView | null;
  lastIncomingAt: UtcTimestamp | null;
  linkedinConversationUrl: string | null;
  linkedinProfileUrl: string | null;
  messages: ProductPage<TimelineMessageView>;
  ownership: OwnershipKind;
  pauseReason: ProductPauseReason | null;
  prospectId: ProspectId;
  revision: number;
  tenantId: TenantId;
  unknownOutcomes: readonly TimelineUnknownOutcomeView[];
  updatedAt: UtcTimestamp;
}>;

export type ConversationTimelineQuery = Readonly<
  ConversationSelector & {
    kind: "GET_CONVERSATION_TIMELINE";
    page: PageRequest;
  }
>;

export type ConversationTimelineResult =
  ProductViewState<ConversationTimelineView>;

export type ConversationTimelineQueryHandler = (
  query: ConversationTimelineQuery
) => Promise<ConversationTimelineResult>;
