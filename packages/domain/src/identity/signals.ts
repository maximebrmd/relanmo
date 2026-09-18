import type { AccountId, TenantId } from "../contracts/ids";
import {
  canonicalizeLinkedInPublicIdentifier,
  normalizeOpaqueProviderId,
} from "./linkedin-identifier";

/**
 * Stable prospect identity, scoped to one tenant/account. Every field is an
 * explicit nullable unknown rather than an inferred guess: a `null` here
 * means the provider or import source did not supply that fact.
 */
export type ProspectIdentitySignals = Readonly<{
  accountId: AccountId;
  /** IDs from a prior system or a prior provider sync; never treated as current. */
  legacyProviderMemberIds: readonly string[];
  /** The provider's own current, opaque member identifier. */
  providerMemberId: string | null;
  /** Canonical LinkedIn vanity identifier, lowercased. */
  publicIdentifier: string | null;
  tenantId: TenantId;
}>;

export type RawLinkedInIdentityInput = Readonly<{
  accountId: AccountId;
  legacyProviderMemberIds: readonly string[];
  /** A full profile URL or a bare vanity identifier; canonicalized here. */
  profileUrl: string | null;
  providerMemberId: string | null;
  tenantId: TenantId;
}>;

function dedupeLegacyIds(
  legacyProviderMemberIds: readonly string[],
  currentProviderMemberId: string | null
): readonly string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const rawId of legacyProviderMemberIds) {
    const normalized = normalizeOpaqueProviderId(rawId);
    if (
      normalized === null ||
      normalized === currentProviderMemberId ||
      seen.has(normalized)
    ) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return Object.freeze(deduped);
}

/**
 * Builds canonical identity signals from raw provider/import facts. This is
 * best-effort and non-throwing: an unrecognized profile URL simply leaves
 * `publicIdentifier` null rather than blocking on a caller that already has
 * other identifiers (a provider member ID, legacy IDs) to work with.
 */
export function buildIdentitySignals(
  input: RawLinkedInIdentityInput
): ProspectIdentitySignals {
  const parsedUrl = canonicalizeLinkedInPublicIdentifier(input.profileUrl);
  const providerMemberId = normalizeOpaqueProviderId(input.providerMemberId);

  return Object.freeze({
    accountId: input.accountId,
    legacyProviderMemberIds: dedupeLegacyIds(
      input.legacyProviderMemberIds,
      providerMemberId
    ),
    providerMemberId,
    publicIdentifier:
      parsedUrl.outcome === "PUBLIC_PROFILE" ? parsedUrl.identifier : null,
    tenantId: input.tenantId,
  });
}
