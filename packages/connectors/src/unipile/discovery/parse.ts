/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof -- Unipile search and profile payloads are untrusted provider values. */

import type { LinkedInProfileField } from "@relanmo/domain";
import { LINKEDIN_PROFILE_FIELDS } from "@relanmo/domain";

export type UnipileObservedPersonFacts = Readonly<{
  currentCompany: string | null;
  currentRole: string | null;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  profileUrl: string | null;
  providerProfileId: string;
}>;

export type UnipilePeopleSearchPage = Readonly<{
  cursor: string | null;
  people: readonly UnipileObservedPersonFacts[];
}>;

export type UnipileObservedRole = Readonly<{
  company: string | null;
  role: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function joinName(
  firstName: string | null,
  lastName: string | null
): string | null {
  if (firstName === null && lastName === null) {
    return null;
  }
  return [firstName, lastName].filter((part) => part !== null).join(" ");
}

export function missingProfileFields(
  input: UnipileObservedPersonFacts
): readonly LinkedInProfileField[] {
  const present: Readonly<Record<LinkedInProfileField, string | null>> = {
    CURRENT_COMPANY: input.currentCompany,
    CURRENT_ROLE: input.currentRole,
    DISPLAY_NAME: input.displayName,
    HEADLINE: input.headline,
    LOCATION: input.location,
    PROFILE_URL: input.profileUrl,
  };
  return LINKEDIN_PROFILE_FIELDS.filter((field) => present[field] === null);
}

function currentPosition(value: unknown): UnipileObservedRole {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) {
        continue;
      }
      const company = readTrimmedString(entry.company);
      const role = readTrimmedString(entry.role ?? entry.position);
      if (company !== null || role !== null) {
        const observed: UnipileObservedRole = { company, role };
        return observed;
      }
    }
  }
  const empty: UnipileObservedRole = { company: null, role: null };
  return empty;
}

function currentWorkExperience(value: unknown): UnipileObservedRole {
  if (!Array.isArray(value)) {
    const empty: UnipileObservedRole = { company: null, role: null };
    return empty;
  }
  for (const entry of value) {
    if (!isRecord(entry) || entry.current !== true) {
      continue;
    }
    const observed: UnipileObservedRole = {
      company: readTrimmedString(entry.company),
      role: readTrimmedString(entry.position ?? entry.role),
    };
    return observed;
  }
  const empty: UnipileObservedRole = { company: null, role: null };
  return empty;
}

function personFactsFromSearchItem(
  value: unknown
): UnipileObservedPersonFacts | null {
  if (!isRecord(value) || value.type !== "PEOPLE") {
    return null;
  }
  const providerProfileId = readTrimmedString(value.id);
  if (providerProfileId === null) {
    return null;
  }
  const position = currentPosition(value.current_positions);
  const facts: UnipileObservedPersonFacts = {
    currentCompany: position.company,
    currentRole: position.role,
    displayName:
      readTrimmedString(value.name) ??
      joinName(
        readTrimmedString(value.first_name),
        readTrimmedString(value.last_name)
      ),
    headline: readTrimmedString(value.headline),
    location: readTrimmedString(value.location),
    profileUrl:
      readTrimmedString(value.public_profile_url) ??
      readTrimmedString(value.profile_url),
    providerProfileId,
  };
  return facts;
}

export function parsePeopleSearchPage(
  value: unknown
): UnipilePeopleSearchPage | null {
  if (!isRecord(value) || value.object !== "LinkedinSearch") {
    return null;
  }
  const people: UnipileObservedPersonFacts[] = [];
  if (Array.isArray(value.items)) {
    for (const item of value.items) {
      const person = personFactsFromSearchItem(item);
      if (person !== null) {
        people.push(person);
      }
    }
  }
  const page: UnipilePeopleSearchPage = {
    cursor: readTrimmedString(value.cursor),
    people,
  };
  return page;
}

export function parseLinkedInProfile(
  value: unknown
): UnipileObservedPersonFacts | null {
  if (!isRecord(value) || value.provider !== "LINKEDIN") {
    return null;
  }
  const providerProfileId = readTrimmedString(value.provider_id);
  if (providerProfileId === null) {
    return null;
  }
  const fromExperience = currentWorkExperience(value.work_experience);
  const fromPositions = currentPosition(value.current_positions);
  const facts: UnipileObservedPersonFacts = {
    currentCompany: fromExperience.company ?? fromPositions.company,
    currentRole: fromExperience.role ?? fromPositions.role,
    displayName: joinName(
      readTrimmedString(value.first_name),
      readTrimmedString(value.last_name)
    ),
    headline: readTrimmedString(value.headline),
    location: readTrimmedString(value.location),
    profileUrl:
      readTrimmedString(value.public_profile_url) ??
      readTrimmedString(value.profile_url),
    providerProfileId,
  };
  return facts;
}

export function isPaidLinkedInCapabilityMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("sales navigator") ||
    normalized.includes("sales_navigator") ||
    normalized.includes("linkedin recruiter")
  );
}
