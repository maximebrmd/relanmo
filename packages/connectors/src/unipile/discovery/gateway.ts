import { UnipileClient } from "unipile-node-sdk";

import type {
  UnipileObservedPersonFacts,
  UnipilePeopleSearchPage,
} from "./parse";
import { parseLinkedInProfile, parsePeopleSearchPage } from "./parse";

export type UnipilePeopleSearchRequest = Readonly<{
  accountId: string;
  api: "classic";
  category: "people";
  cursor: string | null;
  limit: number;
  advancedKeywords?: Readonly<{
    company?: string;
    title?: string;
  }>;
  keywords?: string;
  location?: readonly string[];
}>;

export interface UnipileAdvancedKeywords {
  company?: string;
  title?: string;
}

export interface UnipileClassicPeopleSearchBody {
  advanced_keywords?: UnipileAdvancedKeywords;
  api: "classic";
  category: "people";
  keywords?: string;
  location?: readonly string[];
}

export type UnipileDiscoveryGateway = Readonly<{
  getProfile: (input: {
    accountId: string;
    identifier: string;
  }) => Promise<UnipileObservedPersonFacts>;
  searchPeople: (
    input: UnipilePeopleSearchRequest
  ) => Promise<UnipilePeopleSearchPage>;
}>;

function searchBody(
  input: UnipilePeopleSearchRequest
): UnipileClassicPeopleSearchBody {
  const body: UnipileClassicPeopleSearchBody = {
    api: input.api,
    category: input.category,
  };
  if (input.keywords !== undefined) {
    body.keywords = input.keywords;
  }
  if (input.location !== undefined) {
    body.location = input.location;
  }
  if (input.advancedKeywords !== undefined) {
    const advancedKeywords: UnipileAdvancedKeywords = {};
    if (input.advancedKeywords.company !== undefined) {
      advancedKeywords.company = input.advancedKeywords.company;
    }
    if (input.advancedKeywords.title !== undefined) {
      advancedKeywords.title = input.advancedKeywords.title;
    }
    body.advanced_keywords = advancedKeywords;
  }
  return body;
}

export function createSdkGateway(
  baseUrl: string,
  apiKey: string
): UnipileDiscoveryGateway {
  const client = new UnipileClient(baseUrl, apiKey, {
    logRequestPayload: false,
    logRequestResult: false,
  });
  return {
    async getProfile(input) {
      const parsed = parseLinkedInProfile(
        await client.users.getProfile({
          account_id: input.accountId,
          identifier: input.identifier,
        })
      );
      if (parsed === null) {
        throw new Error("Unipile profile payload was not a LinkedIn profile");
      }
      return parsed;
    },
    async searchPeople(input) {
      /* oxlint-disable anti-slop/no-known-value-widening -- Unipile RequestSender only accepts Record<string, string> query parameters. */
      const parameters: Record<string, string> = {
        account_id: input.accountId,
        limit: String(input.limit),
      };
      /* oxlint-enable anti-slop/no-known-value-widening */
      if (input.cursor !== null) {
        parameters.cursor = input.cursor;
      }
      // People search is absent from unipile-node-sdk@1.9.3 UsersResource.
      // Use the official RequestSender against POST /api/v1/linkedin/search.
      const parsed = parsePeopleSearchPage(
        await client.request.send({
          body: searchBody(input),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          parameters,
          path: ["linkedin", "search"],
        })
      );
      if (parsed === null) {
        throw new Error(
          "Unipile people search payload was not a LinkedIn search page"
        );
      }
      return parsed;
    },
  };
}
