/**
 * Canonicalization of supported LinkedIn identifiers/URLs. This is a pure
 * string transform: no network, database or model calls, and no attempt to
 * decode opaque provider tokens (Sales Navigator/Recruiter URLs) into a
 * public identifier. Unsupported input becomes an explicit `UNSUPPORTED`
 * outcome rather than a guessed identifier.
 */

const SUPPORTED_PUBLIC_PROFILE_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "m.linkedin.com",
]);

/** LinkedIn vanity identifiers: alphanumerics and hyphens, no leading/trailing hyphen. */
const PUBLIC_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,98}[a-z0-9])?$/u;

export const LINKEDIN_URL_PARSE_OUTCOMES = [
  "PUBLIC_PROFILE",
  "UNSUPPORTED",
  "INVALID",
] as const;
export type LinkedInUrlParseOutcome =
  (typeof LINKEDIN_URL_PARSE_OUTCOMES)[number];

export type LinkedInUrlParseResult =
  | Readonly<{ identifier: string; outcome: "PUBLIC_PROFILE" }>
  | Readonly<{ detail: string; outcome: "UNSUPPORTED" }>
  | Readonly<{ detail: string; outcome: "INVALID" }>;

function normalizePublicIdentifierCandidate(
  candidate: string
): LinkedInUrlParseResult {
  const canonical = candidate.trim().toLowerCase();
  if (!PUBLIC_IDENTIFIER_PATTERN.test(canonical)) {
    return Object.freeze({
      detail: "identifier has an unsupported shape",
      outcome: "INVALID",
    });
  }
  return Object.freeze({ identifier: canonical, outcome: "PUBLIC_PROFILE" });
}

/**
 * Canonicalizes a raw LinkedIn public profile URL or bare vanity identifier.
 * Sales Navigator/Recruiter URLs and company pages are recognized hosts but
 * unsupported paths: their opaque tokens are never treated as a public
 * identifier, since we cannot verify they resolve to the same person.
 */
export function canonicalizeLinkedInPublicIdentifier(
  raw: string | null
): LinkedInUrlParseResult {
  if (raw === null) {
    return Object.freeze({ detail: "missing value", outcome: "INVALID" });
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Object.freeze({ detail: "empty value", outcome: "INVALID" });
  }

  if (!/[:/]/u.test(trimmed)) {
    return normalizePublicIdentifierCandidate(trimmed);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );
  } catch {
    return Object.freeze({
      detail: "value is not a parseable URL",
      outcome: "INVALID",
    });
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!SUPPORTED_PUBLIC_PROFILE_HOSTS.has(host)) {
    return Object.freeze({
      detail: `unsupported host: ${host}`,
      outcome: "UNSUPPORTED",
    });
  }

  const segments = parsedUrl.pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length < 2 || segments[0].toLowerCase() !== "in") {
    return Object.freeze({
      detail: "not a public profile path",
      outcome: "UNSUPPORTED",
    });
  }

  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segments[1]);
  } catch {
    return Object.freeze({
      detail: "identifier segment is not valid percent-encoding",
      outcome: "INVALID",
    });
  }

  return normalizePublicIdentifierCandidate(decodedSegment);
}

/** Provider member IDs are opaque tokens: trimmed, never case-folded. */
export function normalizeOpaqueProviderId(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
