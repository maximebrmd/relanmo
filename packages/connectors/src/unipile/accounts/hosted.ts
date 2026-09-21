import { UnipileClient } from "unipile-node-sdk";

import type { UnipileLinkedInAccountSnapshot } from "./parse";
import { parseLinkedInAccount } from "./parse";

export type UnipileHostedAuthRequest =
  | Readonly<{
      api_url: string;
      expiresOn: string;
      failure_redirect_url: string;
      name: string;
      notify_url?: string;
      providers: readonly ["LINKEDIN"];
      success_redirect_url: string;
      type: "create";
    }>
  | Readonly<{
      api_url: string;
      expiresOn: string;
      failure_redirect_url: string;
      name: string;
      notify_url?: string;
      reconnect_account: string;
      success_redirect_url: string;
      type: "reconnect";
    }>;

export type UnipileAccountsGateway = Readonly<{
  createHostedAuthLink: (
    input: UnipileHostedAuthRequest
  ) => Promise<Readonly<{ url: string }>>;
  getAccount: (accountId: string) => Promise<UnipileLinkedInAccountSnapshot>;
}>;

const LINKEDIN_PROVIDERS: ["LINKEDIN"] = ["LINKEDIN"];

function sdkCreateLinkInput(
  input: Extract<UnipileHostedAuthRequest, { type: "create" }>
) {
  if (input.notify_url === undefined) {
    return {
      api_url: input.api_url,
      expiresOn: input.expiresOn,
      failure_redirect_url: input.failure_redirect_url,
      name: input.name,
      providers: LINKEDIN_PROVIDERS,
      success_redirect_url: input.success_redirect_url,
      type: input.type,
    };
  }
  return {
    api_url: input.api_url,
    expiresOn: input.expiresOn,
    failure_redirect_url: input.failure_redirect_url,
    name: input.name,
    notify_url: input.notify_url,
    providers: LINKEDIN_PROVIDERS,
    success_redirect_url: input.success_redirect_url,
    type: input.type,
  };
}

function sdkReconnectLinkInput(
  input: Extract<UnipileHostedAuthRequest, { type: "reconnect" }>
) {
  if (input.notify_url === undefined) {
    return {
      api_url: input.api_url,
      expiresOn: input.expiresOn,
      failure_redirect_url: input.failure_redirect_url,
      name: input.name,
      reconnect_account: input.reconnect_account,
      success_redirect_url: input.success_redirect_url,
      type: input.type,
    };
  }
  return {
    api_url: input.api_url,
    expiresOn: input.expiresOn,
    failure_redirect_url: input.failure_redirect_url,
    name: input.name,
    notify_url: input.notify_url,
    reconnect_account: input.reconnect_account,
    success_redirect_url: input.success_redirect_url,
    type: input.type,
  };
}

export function withNotifyUrl(
  request: UnipileHostedAuthRequest,
  notifyUrl: string | null
): UnipileHostedAuthRequest {
  if (notifyUrl === null) {
    return request;
  }
  if (request.type === "create") {
    return {
      api_url: request.api_url,
      expiresOn: request.expiresOn,
      failure_redirect_url: request.failure_redirect_url,
      name: request.name,
      notify_url: notifyUrl,
      providers: request.providers,
      success_redirect_url: request.success_redirect_url,
      type: "create",
    };
  }
  return {
    api_url: request.api_url,
    expiresOn: request.expiresOn,
    failure_redirect_url: request.failure_redirect_url,
    name: request.name,
    notify_url: notifyUrl,
    reconnect_account: request.reconnect_account,
    success_redirect_url: request.success_redirect_url,
    type: "reconnect",
  };
}

export function createSdkGateway(
  baseUrl: string,
  apiKey: string
): UnipileAccountsGateway {
  const client = new UnipileClient(baseUrl, apiKey, {
    logRequestPayload: false,
    logRequestResult: false,
  });
  return {
    async createHostedAuthLink(input) {
      const response =
        input.type === "create"
          ? await client.account.createHostedAuthLink(sdkCreateLinkInput(input))
          : await client.account.createHostedAuthLink(
              sdkReconnectLinkInput(input)
            );
      return { url: response.url };
    },
    async getAccount(accountId) {
      const parsed = parseLinkedInAccount(
        await client.account.getOne(accountId)
      );
      if (parsed === null) {
        throw new Error("Unipile account payload was not a LinkedIn account");
      }
      return parsed;
    },
  };
}
