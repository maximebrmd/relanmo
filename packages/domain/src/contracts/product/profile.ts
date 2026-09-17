import type { ProfileVersionId, TenantId } from "../ids";
import type { UtcTimestamp } from "../values";
import type {
  ProductCommandResult,
  ProductViewState,
  RevisionGuard,
  TenantSelector,
} from "./common";

export const FRENCH_TONES = [
  "DIRECT",
  "WARM",
  "FORMAL",
  "CONVERSATIONAL",
  "CONCISE",
] as const;
export type FrenchTone = (typeof FRENCH_TONES)[number];

export const ONBOARDING_STEPS = [
  "PROFILE",
  "LINKEDIN",
  "CAMPAIGN",
  "READY",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETE",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export type ProfileInput = Readonly<{
  availability: string | null;
  dayRateCents: number | null;
  exclusions: readonly string[];
  geography: string | null;
  offer: string;
  preferredTone: FrenchTone;
  skills: readonly string[];
  targetMarket: string | null;
  writingSamples: readonly string[];
}>;

export type ProfileView = Readonly<
  ProfileInput & {
    onboardingComplete: boolean;
    profileVersionId: ProfileVersionId | null;
    revision: number;
    styleAdaptation: "PROFILE_FACTS_ONLY";
    tenantId: TenantId;
    updatedAt: UtcTimestamp;
  }
>;

export type OnboardingView = Readonly<{
  completedAt: UtcTimestamp | null;
  currentStep: OnboardingStep;
  profile: ProfileView | null;
  revision: number;
  status: OnboardingStatus;
  tenantId: TenantId;
}>;

export const PROFILE_COMMAND_KINDS = [
  "SAVE_PROFILE",
  "COMPLETE_ONBOARDING",
] as const;
export type ProfileCommandKind = (typeof PROFILE_COMMAND_KINDS)[number];

export type SaveProfileCommand = Readonly<
  TenantSelector &
    RevisionGuard & {
      input: ProfileInput;
      kind: "SAVE_PROFILE";
    }
>;

export type CompleteOnboardingCommand = Readonly<
  TenantSelector &
    RevisionGuard & {
      input: ProfileInput;
      kind: "COMPLETE_ONBOARDING";
    }
>;

export type ProfileCommand = SaveProfileCommand | CompleteOnboardingCommand;

export type ProfileQuery = TenantSelector;

export type ProfileCommandData = Readonly<{
  onboarding: OnboardingView;
  profile: ProfileView;
}>;

export type ProfileCommandResult = ProductCommandResult<ProfileCommandData>;
export type ProfileViewResult = ProductViewState<ProfileView>;
export type OnboardingViewResult = ProductViewState<OnboardingView>;

export type ProfileCommandHandler = (
  command: ProfileCommand
) => Promise<ProfileCommandResult>;
export type ProfileQueryHandler = (
  query: ProfileQuery
) => Promise<ProfileViewResult>;
