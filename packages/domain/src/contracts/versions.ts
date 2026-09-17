import type {
  CampaignVersionId,
  ExplicitStyleVersionId,
  InferredStyleVersionId,
  ModelVersion,
  ProfileVersionId,
  PromptVersionId,
} from "./ids";
import type { UtcTimestamp } from "./values";

export const VERSION_KINDS = [
  "PROFILE",
  "CAMPAIGN",
  "STYLE_EXPLICIT",
  "STYLE_INFERRED",
  "PROMPT_DEFAULT",
] as const;

export type VersionKind = (typeof VERSION_KINDS)[number];

type VersionRefBase = Readonly<{
  createdAt: UtcTimestamp;
  revision: number;
}>;

export type ProfileVersionRef = Readonly<
  VersionRefBase & {
    id: ProfileVersionId;
    kind: "PROFILE";
  }
>;

export type CampaignVersionRef = Readonly<
  VersionRefBase & {
    id: CampaignVersionId;
    kind: "CAMPAIGN";
  }
>;

export type ExplicitStyleVersionRef = Readonly<
  VersionRefBase & {
    id: ExplicitStyleVersionId;
    kind: "STYLE_EXPLICIT";
  }
>;

export type InferredStyleVersionRef = Readonly<
  VersionRefBase & {
    id: InferredStyleVersionId;
    kind: "STYLE_INFERRED";
  }
>;

export type PromptVersionRef = Readonly<
  VersionRefBase & {
    id: PromptVersionId;
    kind: "PROMPT_DEFAULT";
  }
>;

export type VersionRef =
  | ProfileVersionRef
  | CampaignVersionRef
  | ExplicitStyleVersionRef
  | InferredStyleVersionRef
  | PromptVersionRef;

/** The complete current version state used by pure eligibility checks. */
export type CurrentVersionSet = Readonly<{
  acceptedInferredStyle: InferredStyleVersionRef | null;
  campaign: CampaignVersionRef | null;
  defaultPrompt: PromptVersionRef | null;
  explicitStyle: ExplicitStyleVersionRef | null;
  model: ModelVersion | null;
  profile: ProfileVersionRef | null;
}>;

export type DraftSourceVersions = Readonly<{
  acceptedInferredStyle: InferredStyleVersionRef | null;
  campaign: CampaignVersionRef;
  defaultPrompt: PromptVersionRef;
  explicitStyle: ExplicitStyleVersionRef | null;
  model: ModelVersion;
  profile: ProfileVersionRef | null;
}>;
