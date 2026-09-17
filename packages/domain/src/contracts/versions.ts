import type { ModelVersion, VersionId } from "./ids";
import type { UtcTimestamp } from "./values";

export const VERSION_KINDS = [
  "PROFILE",
  "CAMPAIGN",
  "STYLE_EXPLICIT",
  "STYLE_INFERRED",
  "PROMPT_DEFAULT",
] as const;

export type VersionKind = (typeof VERSION_KINDS)[number];

export type VersionRef = Readonly<{
  createdAt: UtcTimestamp;
  id: VersionId;
  kind: VersionKind;
  revision: number;
}>;

export type DraftSourceVersions = Readonly<{
  acceptedInferredStyle: VersionRef | null;
  campaign: VersionRef;
  defaultPrompt: VersionRef;
  explicitStyle: VersionRef | null;
  model: ModelVersion;
  profile: VersionRef | null;
}>;
