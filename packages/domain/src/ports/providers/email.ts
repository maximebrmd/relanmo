import type { TenantId } from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type { ProviderOperationContext, ProviderWriteResult } from "./common";

export type EmailRecipient = Readonly<{
  address: string;
  displayName: string | null;
}>;

export type EmailTemplateParameter = Readonly<{
  key: string;
  value: string;
}>;

export type EmailTemplate =
  | Readonly<{
      kind: "AUTHENTICATION";
      locale: string;
      name: "RESET_PASSWORD" | "SIGN_IN_CODE" | "VERIFY_EMAIL";
      parameters: readonly EmailTemplateParameter[];
    }>
  | Readonly<{
      kind: "NOTIFICATION";
      locale: string;
      name:
        | "ACCOUNT_RECONNECT_REQUIRED"
        | "BILLING_STATUS_CHANGED"
        | "INCOMING_REPLY";
      parameters: readonly EmailTemplateParameter[];
    }>;

export type EmailDeliveryInput = Readonly<{
  context: ProviderOperationContext;
  /** Stable within our tenant and notification ledger; not provider idempotency. */
  deliveryIdentity: string;
  recipient: EmailRecipient;
  template: EmailTemplate;
  tenantId: TenantId;
}>;

export type EmailDelivery = Readonly<{
  acceptedAt: UtcTimestamp;
  deliveryIdentity: string;
  providerMessageId: string | null;
}>;

export type EmailPort = Readonly<{
  send: (
    input: EmailDeliveryInput
  ) => Promise<ProviderWriteResult<EmailDelivery>>;
}>;
