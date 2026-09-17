/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- Product parsers are the explicit untrusted UI/transport boundary. */

import { ACTION_UNKNOWN_REASONS } from "../action";
import { ELIGIBILITY_REASON_CODES } from "../eligibility";
import {
  parseAccountId,
  parseCampaignId,
  parseCampaignVersionId,
  parseConversationId,
  parseEvidenceId,
  parseExplicitStyleVersionId,
  parseInferredStyleVersionId,
  parseMessageId,
  parseProfileVersionId,
  parseProspectId,
  parseTenantId,
} from "../ids";
import {
  ATTACHMENT_KINDS,
  MESSAGE_ACTORS,
  MESSAGE_DIRECTIONS,
  MESSAGE_SOURCES,
} from "../message";
import { OWNERSHIP_KINDS } from "../ownership";
import { parseBusinessWindowConfiguration } from "../parsers";
import {
  ContractValidationError,
  expectArrayOf,
  expectBoolean,
  expectInteger,
  expectNullableString,
  expectRecord,
  expectString,
  isMember,
  isNumber,
  isNull,
  readRequired,
  safeParse,
} from "../runtime";
import { parseDirectMessageStep, parseUtcTimestamp } from "../values";
import {
  BILLING_ENTITLEMENT_STATUSES,
  BILLING_SUBSCRIPTION_STATUSES,
} from "./billing";
import type {
  BillingCommand,
  BillingQuery,
  BillingRedirectView,
  BillingView,
} from "./billing";
import { CAMPAIGN_COMMAND_KINDS, CAMPAIGN_STATUSES } from "./campaign";
import type {
  CampaignCommand,
  CampaignInput,
  CampaignListView,
  CampaignQuery,
  CampaignSequenceStep,
  CampaignTargeting,
  CampaignView,
} from "./campaign";
import {
  parseAccountSelector,
  parseCampaignSelector,
  parseConversationSelector,
  parsePageInfo,
  parsePageRequest,
  parseProductText,
  parseNullableProductText,
  parseProductStringList,
  parseProductViewState,
  parseProspectSelector,
  parseRelativeReturnPath,
  parseRevision,
  parseRevisionGuard,
  parseTenantSelector,
  PRODUCT_PAUSE_REASONS,
} from "./common";
import type { ProductPage, ProductViewState } from "./common";
import {
  LINKEDIN_COMMAND_KINDS,
  LINKEDIN_CONNECTION_STATUSES,
  LINKEDIN_HEALTH_STATUSES,
} from "./connection";
import type {
  LinkedInAccountView,
  LinkedInCapabilities,
  LinkedInCommand,
  LinkedInConnectionStartView,
  LinkedInConnectionView,
} from "./connection";
import { METRICS_COVERAGE } from "./metrics";
import type {
  MetricCounts,
  MetricDateRange,
  MetricRates,
  MetricSpend,
  MetricsQuery,
  MetricsView,
} from "./metrics";
import {
  PIPELINE_AUTOMATION_STATES,
  PIPELINE_EVIDENCE_STATUSES,
  PIPELINE_OWNERSHIP_FILTERS,
  PIPELINE_SORTS,
  PIPELINE_STAGES,
} from "./pipeline";
import type {
  PipelineFilters,
  PipelinePageView,
  PipelineQuery,
  PipelineRowView,
} from "./pipeline";
import {
  FRENCH_TONES,
  ONBOARDING_STATUSES,
  ONBOARDING_STEPS,
  PROFILE_COMMAND_KINDS,
} from "./profile";
import type {
  OnboardingView,
  ProfileCommand,
  ProfileInput,
  ProfileView,
} from "./profile";
import { STYLE_COMMAND_KINDS, STYLE_SOURCES } from "./style";
import type {
  DraftPreviewView,
  StyleCommand,
  StyleInput,
  StyleStepOverride,
  StyleView,
} from "./style";
import { TIMELINE_AUTOMATION_STATES } from "./timeline";
import type {
  ConversationHandoverView,
  ConversationTimelineQuery,
  ConversationTimelineView,
  TimelineAttachmentView,
  TimelineMessageView,
  TimelineUnknownOutcomeView,
} from "./timeline";

export {
  parsePageInfo,
  parsePageRequest,
  parseProductCommandResult,
  parseProductError,
  parseProductViewState,
} from "./common";

function member<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string
): T[number] {
  const parsed = expectString(value, path);
  if (!isMember(parsed, allowed)) {
    throw new ContractValidationError(`${path} has an unsupported value`);
  }
  return parsed;
}

function nullable<T>(value: unknown, parser: (input: unknown) => T): T | null {
  return isNull(value) ? null : parser(value);
}

function parseLinkedInUrl(value: unknown, path: string): string | null {
  const raw = parseNullableProductText(value, path, 2048);
  if (raw === null) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ContractValidationError(`${path} must be a valid URL`);
  }
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com"))
  ) {
    throw new ContractValidationError(`${path} must be an HTTPS LinkedIn URL`);
  }
  return raw;
}

function parseRedirectUrl(value: unknown, path: string): string {
  const raw = parseProductText(value, path, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ContractValidationError(`${path} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new ContractValidationError(`${path} must use HTTPS`);
  }
  return raw;
}

function parseNonNegativeCount(value: unknown, path: string): number {
  return expectInteger(value, path, 0, 100_000_000);
}

function parseProfileInputAt(value: unknown, path: string): ProfileInput {
  const record = expectRecord(value, path);
  return Object.freeze({
    availability: parseNullableProductText(
      readRequired(record, "availability"),
      `${path}.availability`,
      500
    ),
    dayRateCents: nullable(readRequired(record, "dayRateCents"), (input) =>
      expectInteger(input, `${path}.dayRateCents`, 0, 10_000_000)
    ),
    exclusions: parseProductStringList(
      readRequired(record, "exclusions"),
      `${path}.exclusions`,
      20,
      240
    ),
    geography: parseNullableProductText(
      readRequired(record, "geography"),
      `${path}.geography`,
      500
    ),
    offer: parseProductText(
      readRequired(record, "offer"),
      `${path}.offer`,
      1000
    ),
    preferredTone: member(
      readRequired(record, "preferredTone"),
      FRENCH_TONES,
      `${path}.preferredTone`
    ),
    skills: parseProductStringList(
      readRequired(record, "skills"),
      `${path}.skills`,
      30,
      160
    ),
    targetMarket: parseNullableProductText(
      readRequired(record, "targetMarket"),
      `${path}.targetMarket`,
      500
    ),
    writingSamples: parseProductStringList(
      readRequired(record, "writingSamples"),
      `${path}.writingSamples`,
      3,
      5000
    ),
  });
}

function parseProductPauseReason(value: unknown, path: string) {
  return member(value, PRODUCT_PAUSE_REASONS, path);
}

export function parseProfileInput(value: unknown): ProfileInput {
  return parseProfileInputAt(value, "profile");
}

export function parseProfileView(value: unknown): ProfileView {
  const record = expectRecord(value, "profile");
  return Object.freeze({
    ...parseProfileInputAt(record, "profile"),
    onboardingComplete: expectBoolean(
      readRequired(record, "onboardingComplete"),
      "profile.onboardingComplete"
    ),
    profileVersionId: nullable(
      readRequired(record, "profileVersionId"),
      parseProfileVersionId
    ),
    revision: parseRevision(
      readRequired(record, "revision"),
      "profile.revision"
    ),
    styleAdaptation: member(
      readRequired(record, "styleAdaptation"),
      ["PROFILE_FACTS_ONLY"] as const,
      "profile.styleAdaptation"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    updatedAt: parseUtcTimestamp(readRequired(record, "updatedAt")),
  });
}

export function parseOnboardingView(value: unknown): OnboardingView {
  const record = expectRecord(value, "onboarding");
  return Object.freeze({
    completedAt: nullable(
      readRequired(record, "completedAt"),
      parseUtcTimestamp
    ),
    currentStep: member(
      readRequired(record, "currentStep"),
      ONBOARDING_STEPS,
      "onboarding.currentStep"
    ),
    profile: nullable(readRequired(record, "profile"), parseProfileView),
    revision: parseRevision(
      readRequired(record, "revision"),
      "onboarding.revision"
    ),
    status: member(
      readRequired(record, "status"),
      ONBOARDING_STATUSES,
      "onboarding.status"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseProfileCommand(value: unknown): ProfileCommand {
  const record = expectRecord(value, "profileCommand");
  const kind = member(
    readRequired(record, "kind"),
    PROFILE_COMMAND_KINDS,
    "profileCommand.kind"
  );
  const selector = parseTenantSelector(record);
  const guard = parseRevisionGuard(record);
  const input = parseProfileInputAt(
    readRequired(record, "input"),
    "profileCommand.input"
  );
  return Object.freeze({ ...selector, ...guard, input, kind });
}

export function safeParseProfileCommand(value: unknown) {
  return safeParse(parseProfileCommand, value);
}

function parseCampaignTargetingAt(
  value: unknown,
  path: string
): CampaignTargeting {
  const record = expectRecord(value, path);
  return Object.freeze({
    companySizes: parseProductStringList(
      readRequired(record, "companySizes"),
      `${path}.companySizes`,
      10,
      120
    ),
    geographies: parseProductStringList(
      readRequired(record, "geographies"),
      `${path}.geographies`,
      20,
      120
    ),
    industries: parseProductStringList(
      readRequired(record, "industries"),
      `${path}.industries`,
      20,
      160
    ),
    jobTitles: parseProductStringList(
      readRequired(record, "jobTitles"),
      `${path}.jobTitles`,
      30,
      160
    ),
    seniority: parseProductStringList(
      readRequired(record, "seniority"),
      `${path}.seniority`,
      10,
      120
    ),
  });
}

function parseCampaignSequenceStep(
  value: unknown,
  path: string,
  index: number
): CampaignSequenceStep {
  const record = expectRecord(value, path);
  const step = member(
    readRequired(record, "step"),
    ["INVITATION", "DM1", "DM2", "DM3", "DM4", "DM5"] as const,
    `${path}.step`
  );
  const minimumGap = nullable(
    readRequired(record, "minimumGapFromPreviousSendDays"),
    (input) =>
      expectInteger(input, `${path}.minimumGapFromPreviousSendDays`, 0, 60)
  );
  const targetOffset = nullable(
    readRequired(record, "targetOffsetFromAcceptanceDays"),
    (input) =>
      expectInteger(input, `${path}.targetOffsetFromAcceptanceDays`, 0, 365)
  );
  const requiresAcceptance = expectBoolean(
    readRequired(record, "requiresAcceptance"),
    `${path}.requiresAcceptance`
  );
  const expectedSteps = [
    "INVITATION",
    "DM1",
    "DM2",
    "DM3",
    "DM4",
    "DM5",
  ] as const;
  if (step !== expectedSteps[index]) {
    throw new ContractValidationError(
      `${path}.step must preserve the invitation and DM1-DM5 order`
    );
  }
  if (step === "INVITATION") {
    if (requiresAcceptance || minimumGap !== null || targetOffset !== null) {
      throw new ContractValidationError(
        "the invitation cannot require acceptance or have a message delay"
      );
    }
  } else if (!requiresAcceptance || targetOffset === null) {
    throw new ContractValidationError(
      `${path} direct messages must require acceptance and have a target offset`
    );
  } else {
    const minimumGaps = {
      DM1: null,
      DM2: 2,
      DM3: 3,
      DM4: 4,
      DM5: 5,
    } as const;
    const targetOffsets = {
      DM1: 0,
      DM2: 2,
      DM3: 5,
      DM4: 9,
      DM5: 14,
    } as const;
    if (
      minimumGap !== minimumGaps[step] ||
      targetOffset < targetOffsets[step]
    ) {
      throw new ContractValidationError(
        `${path} must preserve the bounded DM1-DM5 cadence minimums`
      );
    }
  }
  return Object.freeze({
    minimumGapFromPreviousSendDays: minimumGap,
    requiresAcceptance,
    step,
    targetOffsetFromAcceptanceDays: targetOffset,
  });
}

function parseCampaignInputAt(value: unknown, path: string): CampaignInput {
  const record = expectRecord(value, path);
  let sequenceIndex = 0;
  const sequence = expectArrayOf(
    readRequired(record, "sequence"),
    (item, itemPath) => {
      const currentIndex = sequenceIndex;
      sequenceIndex += 1;
      return parseCampaignSequenceStep(item, itemPath, currentIndex);
    },
    `${path}.sequence`,
    6
  );
  if (sequence.length !== 6) {
    throw new ContractValidationError(
      `${path}.sequence must contain exactly invitation and DM1-DM5`
    );
  }
  for (let index = 1; index < sequence.length; index += 1) {
    const previous = sequence[index - 1]?.targetOffsetFromAcceptanceDays;
    const current = sequence[index]?.targetOffsetFromAcceptanceDays;
    if (previous !== null && current !== null && current < previous) {
      throw new ContractValidationError(
        `${path}.sequence target offsets must not move backwards`
      );
    }
  }
  const targeting = parseCampaignTargetingAt(
    readRequired(record, "targeting"),
    `${path}.targeting`
  );
  if (
    targeting.companySizes.length === 0 &&
    targeting.geographies.length === 0 &&
    targeting.industries.length === 0 &&
    targeting.jobTitles.length === 0 &&
    targeting.seniority.length === 0
  ) {
    throw new ContractValidationError(
      `${path}.targeting must include at least one ICP criterion`
    );
  }
  return Object.freeze({
    businessWindow: parseBusinessWindowConfiguration(
      readRequired(record, "businessWindow")
    ),
    dailyQuota: expectInteger(
      readRequired(record, "dailyQuota"),
      `${path}.dailyQuota`,
      1,
      100
    ),
    exclusions: parseProductStringList(
      readRequired(record, "exclusions"),
      `${path}.exclusions`,
      30,
      240
    ),
    name: parseProductText(readRequired(record, "name"), `${path}.name`, 240),
    offer: parseProductText(
      readRequired(record, "offer"),
      `${path}.offer`,
      1000
    ),
    sequence,
    targeting,
  });
}

export function parseCampaignInput(value: unknown): CampaignInput {
  return parseCampaignInputAt(value, "campaign");
}

export function parseCampaignView(value: unknown): CampaignView {
  const record = expectRecord(value, "campaign");
  const outboundPaused = expectBoolean(
    readRequired(record, "outboundPaused"),
    "campaign.outboundPaused"
  );
  const pauseReason = nullable(readRequired(record, "pauseReason"), (input) =>
    parseProductPauseReason(input, "campaign.pauseReason")
  );
  const status = member(
    readRequired(record, "status"),
    CAMPAIGN_STATUSES,
    "campaign.status"
  );
  if (outboundPaused !== (pauseReason !== null)) {
    throw new ContractValidationError(
      "campaign pauseReason must match outboundPaused"
    );
  }
  if (status === "ACTIVE" && outboundPaused) {
    throw new ContractValidationError(
      "active campaigns cannot report paused outbound work"
    );
  }
  if (status === "PAUSED" && !outboundPaused) {
    throw new ContractValidationError(
      "paused campaigns must report paused outbound work"
    );
  }
  return Object.freeze({
    ...parseCampaignInputAt(record, "campaign"),
    activationAuthorizesBoundedSequence: true,
    activatedAt: nullable(
      readRequired(record, "activatedAt"),
      parseUtcTimestamp
    ),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    campaignVersionId: nullable(
      readRequired(record, "campaignVersionId"),
      parseCampaignVersionId
    ),
    outboundPaused,
    pauseReason,
    pausedAt: nullable(readRequired(record, "pausedAt"), parseUtcTimestamp),
    revision: parseRevision(
      readRequired(record, "revision"),
      "campaign.revision"
    ),
    status,
    stopOnReply: true,
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    updatedAt: parseUtcTimestamp(readRequired(record, "updatedAt")),
  });
}

export function parseCampaignCommand(value: unknown): CampaignCommand {
  const record = expectRecord(value, "campaignCommand");
  const kind = member(
    readRequired(record, "kind"),
    CAMPAIGN_COMMAND_KINDS,
    "campaignCommand.kind"
  );
  if (kind === "CREATE_CAMPAIGN") {
    return Object.freeze({
      ...parseTenantSelector(record),
      input: parseCampaignInputAt(
        readRequired(record, "input"),
        "campaignCommand.input"
      ),
      kind,
    });
  }
  const selector = parseCampaignSelector(record);
  const guard = parseRevisionGuard(record);
  if (kind === "UPDATE_CAMPAIGN") {
    return Object.freeze({
      ...selector,
      ...guard,
      input: parseCampaignInputAt(
        readRequired(record, "input"),
        "campaignCommand.input"
      ),
      kind,
    });
  }
  return Object.freeze({ ...selector, ...guard, kind });
}

export function parseCampaignQuery(value: unknown): CampaignQuery {
  const record = expectRecord(value, "campaignQuery");
  const kind = member(
    readRequired(record, "kind"),
    ["LIST_CAMPAIGNS", "GET_CAMPAIGN"] as const,
    "campaignQuery.kind"
  );
  if (kind === "LIST_CAMPAIGNS") {
    return Object.freeze({
      ...parseTenantSelector(record),
      kind,
      page: parsePageRequest(readRequired(record, "page")),
    });
  }
  return Object.freeze({ ...parseCampaignSelector(record), kind });
}

export function safeParseCampaignCommand(value: unknown) {
  return safeParse(parseCampaignCommand, value);
}

function parseLinkedInCapabilitiesAt(
  value: unknown,
  path: string
): LinkedInCapabilities {
  const record = expectRecord(value, path);
  return Object.freeze({
    canInvite: nullable(readRequired(record, "canInvite"), (input) =>
      expectBoolean(input, `${path}.canInvite`)
    ),
    canMessage: nullable(readRequired(record, "canMessage"), (input) =>
      expectBoolean(input, `${path}.canMessage`)
    ),
    canReadMessages: nullable(
      readRequired(record, "canReadMessages"),
      (input) => expectBoolean(input, `${path}.canReadMessages`)
    ),
    canSearch: nullable(readRequired(record, "canSearch"), (input) =>
      expectBoolean(input, `${path}.canSearch`)
    ),
  });
}

export function parseLinkedInAccountView(value: unknown): LinkedInAccountView {
  const record = expectRecord(value, "linkedinAccount");
  const outboundPaused = expectBoolean(
    readRequired(record, "outboundPaused"),
    "linkedinAccount.outboundPaused"
  );
  const pauseReason = nullable(readRequired(record, "pauseReason"), (input) =>
    parseProductPauseReason(input, "linkedinAccount.pauseReason")
  );
  if (outboundPaused !== (pauseReason !== null)) {
    throw new ContractValidationError(
      "linkedinAccount pauseReason must match outboundPaused"
    );
  }
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    capabilities: parseLinkedInCapabilitiesAt(
      readRequired(record, "capabilities"),
      "linkedinAccount.capabilities"
    ),
    connectedAt: nullable(
      readRequired(record, "connectedAt"),
      parseUtcTimestamp
    ),
    displayName: parseNullableProductText(
      readRequired(record, "displayName"),
      "linkedinAccount.displayName",
      240
    ),
    health: member(
      readRequired(record, "health"),
      LINKEDIN_HEALTH_STATUSES,
      "linkedinAccount.health"
    ),
    lastCheckedAt: nullable(
      readRequired(record, "lastCheckedAt"),
      parseUtcTimestamp
    ),
    outboundPaused,
    pauseReason,
    reconciliationRequired: expectBoolean(
      readRequired(record, "reconciliationRequired"),
      "linkedinAccount.reconciliationRequired"
    ),
    revision: parseRevision(
      readRequired(record, "revision"),
      "linkedinAccount.revision"
    ),
    status: member(
      readRequired(record, "status"),
      LINKEDIN_CONNECTION_STATUSES,
      "linkedinAccount.status"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseLinkedInConnectionView(
  value: unknown
): LinkedInConnectionView {
  const record = expectRecord(value, "linkedinConnection");
  const accounts = expectArrayOf(
    readRequired(record, "accounts"),
    (item) => parseLinkedInAccountView(item),
    "linkedinConnection.accounts",
    5
  );
  const tenantId = parseTenantId(readRequired(record, "tenantId"));
  if (accounts.some((account) => account.tenantId !== tenantId)) {
    throw new ContractValidationError(
      "linkedinConnection accounts must belong to the view tenant"
    );
  }
  const selectedAccountId = nullable(
    readRequired(record, "selectedAccountId"),
    parseAccountId
  );
  if (
    selectedAccountId !== null &&
    !accounts.some((account) => account.accountId === selectedAccountId)
  ) {
    throw new ContractValidationError(
      "linkedinConnection.selectedAccountId must reference an account in the view"
    );
  }
  return Object.freeze({
    accounts,
    selectedAccountId,
    tenantId,
  });
}

export function parseLinkedInConnectionStartView(
  value: unknown
): LinkedInConnectionStartView {
  const record = expectRecord(value, "linkedinConnectionStart");
  return Object.freeze({
    expiresAt: parseUtcTimestamp(readRequired(record, "expiresAt")),
    hostedAuthUrl: parseRedirectUrl(
      readRequired(record, "hostedAuthUrl"),
      "linkedinConnectionStart.hostedAuthUrl"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseLinkedInCommand(value: unknown): LinkedInCommand {
  const record = expectRecord(value, "linkedinCommand");
  const kind = member(
    readRequired(record, "kind"),
    LINKEDIN_COMMAND_KINDS,
    "linkedinCommand.kind"
  );
  if (kind === "START_LINKEDIN_CONNECTION") {
    return Object.freeze({
      ...parseTenantSelector(record),
      kind,
      returnTo: parseRelativeReturnPath(readRequired(record, "returnTo")),
    });
  }
  return Object.freeze({
    ...parseAccountSelector(record),
    ...parseRevisionGuard(record),
    kind,
  });
}

export function safeParseLinkedInCommand(value: unknown) {
  return safeParse(parseLinkedInCommand, value);
}

function parseStyleStepOverride(
  value: unknown,
  path: string,
  seen: Set<string>
): StyleStepOverride {
  const record = expectRecord(value, path);
  const step = member(
    readRequired(record, "step"),
    ["DM1", "DM2", "DM3", "DM4", "DM5"] as const,
    `${path}.step`
  );
  if (seen.has(step)) {
    throw new ContractValidationError(`${path}.step must be unique`);
  }
  seen.add(step);
  return Object.freeze({
    step,
    text: parseProductText(readRequired(record, "text"), `${path}.text`, 2000),
  });
}

function parseStyleInputAt(value: unknown, path: string): StyleInput {
  const record = expectRecord(value, path);
  const seen = new Set<string>();
  return Object.freeze({
    examples: parseProductStringList(
      readRequired(record, "examples"),
      `${path}.examples`,
      5,
      5000
    ),
    instructions: parseNullableProductText(
      readRequired(record, "instructions"),
      `${path}.instructions`,
      2000
    ),
    stepOverrides: expectArrayOf(
      readRequired(record, "stepOverrides"),
      (item, itemPath) => parseStyleStepOverride(item, itemPath, seen),
      `${path}.stepOverrides`,
      5
    ),
    tone: member(readRequired(record, "tone"), FRENCH_TONES, `${path}.tone`),
  });
}

export function parseStyleInput(value: unknown): StyleInput {
  return parseStyleInputAt(value, "style");
}

export function parseStyleView(value: unknown): StyleView {
  const record = expectRecord(value, "style");
  const acceptedInferredStyleVersionId = nullable(
    readRequired(record, "acceptedInferredStyleVersionId"),
    parseInferredStyleVersionId
  );
  const explicitStyleVersionId = nullable(
    readRequired(record, "explicitStyleVersionId"),
    parseExplicitStyleVersionId
  );
  const inferredEvidenceIds = expectArrayOf(
    readRequired(record, "inferredEvidenceIds"),
    (item) => parseEvidenceId(item),
    "style.inferredEvidenceIds",
    20
  );
  const source = member(
    readRequired(record, "source"),
    STYLE_SOURCES,
    "style.source"
  );
  const suggestedInferredStyleVersionId = nullable(
    readRequired(record, "suggestedInferredStyleVersionId"),
    parseInferredStyleVersionId
  );
  if (
    (acceptedInferredStyleVersionId !== null ||
      suggestedInferredStyleVersionId !== null) &&
    inferredEvidenceIds.length === 0
  ) {
    throw new ContractValidationError(
      "inferred styles require at least one evidence ID"
    );
  }
  if (
    source === "INFERRED_ACCEPTED" &&
    acceptedInferredStyleVersionId === null
  ) {
    throw new ContractValidationError(
      "accepted inferred style views must include their accepted version"
    );
  }
  if (source === "EXPLICIT" && explicitStyleVersionId === null) {
    throw new ContractValidationError(
      "explicit style views must include their explicit version"
    );
  }
  return Object.freeze({
    ...parseStyleInputAt(record, "style"),
    acceptedInferredStyleVersionId,
    explicitStyleVersionId,
    inferredEvidenceIds,
    revision: parseRevision(readRequired(record, "revision"), "style.revision"),
    source,
    suggestedInferredStyleVersionId,
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    updatedAt: parseUtcTimestamp(readRequired(record, "updatedAt")),
  });
}

export function parseDraftPreviewView(value: unknown): DraftPreviewView {
  const record = expectRecord(value, "draftPreview");
  const sendEnqueued = expectBoolean(
    readRequired(record, "sendEnqueued"),
    "draftPreview.sendEnqueued"
  );
  if (sendEnqueued) {
    throw new ContractValidationError(
      "draft previews must never enqueue an outbound send"
    );
  }
  const sendAuthorization = member(
    readRequired(record, "sendAuthorization"),
    ["NOT_REQUESTED"] as const,
    "draftPreview.sendAuthorization"
  );
  return Object.freeze({
    expiresAt: parseUtcTimestamp(readRequired(record, "expiresAt")),
    generatedAt: parseUtcTimestamp(readRequired(record, "generatedAt")),
    previewId: parseProductText(
      readRequired(record, "previewId"),
      "draftPreview.previewId",
      128
    ),
    sendAuthorization,
    sendEnqueued: false,
    step: member(
      readRequired(record, "step"),
      ["DM1", "DM2", "DM3", "DM4", "DM5"] as const,
      "draftPreview.step"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    text: parseProductText(
      readRequired(record, "text"),
      "draftPreview.text",
      5000
    ),
  });
}

export function parseStyleCommand(value: unknown): StyleCommand {
  const record = expectRecord(value, "styleCommand");
  const kind = member(
    readRequired(record, "kind"),
    STYLE_COMMAND_KINDS,
    "styleCommand.kind"
  );
  if (kind === "SAVE_STYLE") {
    return Object.freeze({
      ...parseTenantSelector(record),
      ...parseRevisionGuard(record),
      input: parseStyleInputAt(
        readRequired(record, "input"),
        "styleCommand.input"
      ),
      kind,
    });
  }
  if (kind === "RESET_STYLE_OVERRIDE") {
    return Object.freeze({
      ...parseTenantSelector(record),
      ...parseRevisionGuard(record),
      kind,
      step: member(
        readRequired(record, "step"),
        ["DM1", "DM2", "DM3", "DM4", "DM5"] as const,
        "styleCommand.step"
      ),
    });
  }
  if (kind === "ACCEPT_INFERRED_STYLE") {
    return Object.freeze({
      ...parseTenantSelector(record),
      ...parseRevisionGuard(record),
      inferredStyleVersionId: parseInferredStyleVersionId(
        readRequired(record, "inferredStyleVersionId")
      ),
      kind,
    });
  }
  return Object.freeze({
    ...parseProspectSelector(record),
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    kind,
    step: member(
      readRequired(record, "step"),
      ["DM1", "DM2", "DM3", "DM4", "DM5"] as const,
      "styleCommand.step"
    ),
    styleRevision: parseRevision(
      readRequired(record, "styleRevision"),
      "styleCommand.styleRevision"
    ),
  });
}

export function safeParseStyleCommand(value: unknown) {
  return safeParse(parseStyleCommand, value);
}

function parsePipelineFiltersAt(value: unknown, path: string): PipelineFilters {
  const record = expectRecord(value, path);
  return Object.freeze({
    accountId: nullable(readRequired(record, "accountId"), parseAccountId),
    automation: nullable(readRequired(record, "automation"), (input) =>
      member(input, PIPELINE_AUTOMATION_STATES, `${path}.automation`)
    ),
    campaignId: nullable(readRequired(record, "campaignId"), parseCampaignId),
    evidence: nullable(readRequired(record, "evidence"), (input) =>
      member(input, PIPELINE_EVIDENCE_STATUSES, `${path}.evidence`)
    ),
    ownership: member(
      readRequired(record, "ownership"),
      PIPELINE_OWNERSHIP_FILTERS,
      `${path}.ownership`
    ),
    search: parseNullableProductText(
      readRequired(record, "search"),
      `${path}.search`,
      100
    ),
    sort: member(readRequired(record, "sort"), PIPELINE_SORTS, `${path}.sort`),
    stage: nullable(readRequired(record, "stage"), (input) =>
      member(input, PIPELINE_STAGES, `${path}.stage`)
    ),
  });
}

export function parsePipelineFilters(value: unknown): PipelineFilters {
  return parsePipelineFiltersAt(value, "pipeline.filters");
}

export function parsePipelineQuery(value: unknown): PipelineQuery {
  const record = expectRecord(value, "pipelineQuery");
  const kind = member(
    readRequired(record, "kind"),
    ["LIST_PIPELINE"] as const,
    "pipelineQuery.kind"
  );
  return Object.freeze({
    ...parseTenantSelector(record),
    filters: parsePipelineFiltersAt(
      readRequired(record, "filters"),
      "pipelineQuery.filters"
    ),
    kind,
    page: parsePageRequest(readRequired(record, "page")),
  });
}

export function parsePipelineRowView(value: unknown): PipelineRowView {
  const record = expectRecord(value, "pipelineRow");
  const ownership = member(
    readRequired(record, "ownership"),
    OWNERSHIP_KINDS,
    "pipelineRow.ownership"
  );
  const automation = member(
    readRequired(record, "automation"),
    PIPELINE_AUTOMATION_STATES,
    "pipelineRow.automation"
  );
  if (ownership === "HUMAN_OWNED" && automation === "ACTIVE") {
    throw new ContractValidationError(
      "human-owned pipeline rows cannot report active automation"
    );
  }
  if (automation === "HUMAN_HANDOVER" && ownership !== "HUMAN_OWNED") {
    throw new ContractValidationError(
      "human handover rows must be human-owned"
    );
  }
  const unknownActionCount = parseNonNegativeCount(
    readRequired(record, "unknownActionCount"),
    "pipelineRow.unknownActionCount"
  );
  if (unknownActionCount > 0 && automation === "ACTIVE") {
    throw new ContractValidationError(
      "rows with unknown actions cannot report active automation"
    );
  }
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    automation,
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    campaignName: parseProductText(
      readRequired(record, "campaignName"),
      "pipelineRow.campaignName",
      240
    ),
    conversationId: nullable(
      readRequired(record, "conversationId"),
      parseConversationId
    ),
    displayName: parseNullableProductText(
      readRequired(record, "displayName"),
      "pipelineRow.displayName",
      240
    ),
    evidenceCount: parseNonNegativeCount(
      readRequired(record, "evidenceCount"),
      "pipelineRow.evidenceCount"
    ),
    evidenceStatus: member(
      readRequired(record, "evidenceStatus"),
      PIPELINE_EVIDENCE_STATUSES,
      "pipelineRow.evidenceStatus"
    ),
    headline: parseNullableProductText(
      readRequired(record, "headline"),
      "pipelineRow.headline",
      500
    ),
    holdReasons: expectArrayOf(
      readRequired(record, "holdReasons"),
      (item, itemPath) => member(item, ELIGIBILITY_REASON_CODES, itemPath),
      "pipelineRow.holdReasons",
      10
    ),
    lastActivityAt: nullable(
      readRequired(record, "lastActivityAt"),
      parseUtcTimestamp
    ),
    nextDueAt: nullable(readRequired(record, "nextDueAt"), parseUtcTimestamp),
    nextStep: nullable(readRequired(record, "nextStep"), (input) =>
      member(
        input,
        ["INVITATION", "DM1", "DM2", "DM3", "DM4", "DM5"] as const,
        "pipelineRow.nextStep"
      )
    ),
    ownership,
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    stage: member(
      readRequired(record, "stage"),
      PIPELINE_STAGES,
      "pipelineRow.stage"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    unknownActionCount,
  });
}

function parseProductPageAt<T>(
  value: unknown,
  itemParser: (input: unknown) => T,
  path: string
): ProductPage<T> {
  const record = expectRecord(value, path);
  return Object.freeze({
    items: expectArrayOf(
      readRequired(record, "items"),
      (item) => itemParser(item),
      `${path}.items`,
      50
    ),
    page: parsePageInfo(readRequired(record, "page")),
  });
}

export function parseCampaignListView(value: unknown): CampaignListView {
  return parseProductPageAt(value, parseCampaignView, "campaigns");
}

export function parseCampaignListViewState(
  value: unknown
): ProductViewState<CampaignListView> {
  return parseProductViewState(value, parseCampaignListView);
}

export function parsePipelinePageView(value: unknown): PipelinePageView {
  return parseProductPageAt(value, parsePipelineRowView, "pipeline");
}

export function parsePipelineViewState(
  value: unknown
): ProductViewState<PipelinePageView> {
  return parseProductViewState(value, parsePipelinePageView);
}

export function parseTimelineAttachmentView(
  value: unknown
): TimelineAttachmentView {
  const record = expectRecord(value, "timelineAttachment");
  return Object.freeze({
    contentType: parseNullableProductText(
      readRequired(record, "contentType"),
      "timelineAttachment.contentType",
      160
    ),
    kind: member(
      readRequired(record, "kind"),
      ATTACHMENT_KINDS,
      "timelineAttachment.kind"
    ),
    name: parseNullableProductText(
      readRequired(record, "name"),
      "timelineAttachment.name",
      240
    ),
    sizeBytes: nullable(readRequired(record, "sizeBytes"), (input) =>
      expectInteger(input, "timelineAttachment.sizeBytes", 0, 100_000_000)
    ),
  });
}

export function parseTimelineMessageView(value: unknown): TimelineMessageView {
  const record = expectRecord(value, "timelineMessage");
  const direction = member(
    readRequired(record, "direction"),
    MESSAGE_DIRECTIONS,
    "timelineMessage.direction"
  );
  const actor = member(
    readRequired(record, "actor"),
    MESSAGE_ACTORS,
    "timelineMessage.actor"
  );
  if (
    (direction === "INBOUND" && actor !== "PROSPECT" && actor !== "UNKNOWN") ||
    (direction === "OUTBOUND" && actor === "PROSPECT")
  ) {
    throw new ContractValidationError(
      "timeline message actor must agree with its direction"
    );
  }
  const attachments = expectArrayOf(
    readRequired(record, "attachments"),
    (item) => parseTimelineAttachmentView(item),
    "timelineMessage.attachments",
    20
  );
  const text = expectNullableString(
    readRequired(record, "text"),
    "timelineMessage.text"
  );
  if (text !== null && text.length > 10_000) {
    throw new ContractValidationError("timelineMessage.text is too long");
  }
  const source = member(
    readRequired(record, "source"),
    MESSAGE_SOURCES,
    "timelineMessage.source"
  );
  if (direction === "INBOUND" && source === "SEND_LEDGER") {
    throw new ContractValidationError(
      "SEND_LEDGER cannot be the source of an inbound timeline message"
    );
  }
  if ((text === null || text.length === 0) && attachments.length === 0) {
    throw new ContractValidationError(
      "timeline messages need text or at least one attachment"
    );
  }
  return Object.freeze({
    actor,
    attachments,
    direction,
    messageId: parseMessageId(readRequired(record, "messageId")),
    occurredAt: parseUtcTimestamp(readRequired(record, "occurredAt")),
    receivedAt: parseUtcTimestamp(readRequired(record, "receivedAt")),
    source,
    text,
  });
}

function parseConversationHandover(
  value: unknown,
  path = "handover"
): ConversationHandoverView {
  const record = expectRecord(value, path);
  const required = expectBoolean(
    readRequired(record, "required"),
    `${path}.required`
  );
  const instruction = member(
    readRequired(record, "instruction"),
    ["REPLY_IN_LINKEDIN"] as const,
    `${path}.instruction`
  );
  const reason = member(
    readRequired(record, "reason"),
    [
      "INCOMING_MESSAGE",
      "IMPORTED_MANUAL_CONVERSATION",
      "MANUAL_REPLY",
      "UNMATCHED_OUTGOING_MESSAGE",
    ] as const,
    `${path}.reason`
  );
  if (!required) {
    throw new ContractValidationError(
      "a handover entry is only present when human reply is required"
    );
  }
  return Object.freeze({ instruction, reason, required });
}

function parseTimelineUnknownOutcome(
  value: unknown,
  path: string
): TimelineUnknownOutcomeView {
  const record = expectRecord(value, path);
  return Object.freeze({
    occurredAt: parseUtcTimestamp(readRequired(record, "occurredAt")),
    reason: member(
      readRequired(record, "reason"),
      ACTION_UNKNOWN_REASONS,
      `${path}.reason`
    ),
    step: parseDirectMessageStep(readRequired(record, "step")),
  });
}

export function parseConversationTimelineView(
  value: unknown
): ConversationTimelineView {
  const record = expectRecord(value, "conversationTimeline");
  const ownership = member(
    readRequired(record, "ownership"),
    OWNERSHIP_KINDS,
    "conversationTimeline.ownership"
  );
  const automation = member(
    readRequired(record, "automation"),
    TIMELINE_AUTOMATION_STATES,
    "conversationTimeline.automation"
  );
  const handover = nullable(readRequired(record, "handover"), (input) =>
    parseConversationHandover(input)
  );
  if (ownership === "HUMAN_OWNED" && handover === null) {
    throw new ContractValidationError(
      "human-owned conversations must explain the LinkedIn handover"
    );
  }
  if (automation === "HUMAN_HANDOVER" && ownership !== "HUMAN_OWNED") {
    throw new ContractValidationError(
      "human handover conversations must be human-owned"
    );
  }
  const pauseReason = nullable(readRequired(record, "pauseReason"), (input) =>
    parseProductPauseReason(input, "conversationTimeline.pauseReason")
  );
  const unknownOutcomes = expectArrayOf(
    readRequired(record, "unknownOutcomes"),
    (item, itemPath) => parseTimelineUnknownOutcome(item, itemPath),
    "conversationTimeline.unknownOutcomes",
    20
  );
  if (
    (automation === "PAUSED" || automation === "HUMAN_HANDOVER") &&
    pauseReason === null
  ) {
    throw new ContractValidationError(
      "paused or handed-over conversations must include a pause reason"
    );
  }
  if (automation === "ACTIVE" && pauseReason !== null) {
    throw new ContractValidationError(
      "active conversations cannot include a pause reason"
    );
  }
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    automation,
    conversationId: parseConversationId(readRequired(record, "conversationId")),
    handover,
    lastIncomingAt: nullable(
      readRequired(record, "lastIncomingAt"),
      parseUtcTimestamp
    ),
    linkedinConversationUrl: parseLinkedInUrl(
      readRequired(record, "linkedinConversationUrl"),
      "conversationTimeline.linkedinConversationUrl"
    ),
    linkedinProfileUrl: parseLinkedInUrl(
      readRequired(record, "linkedinProfileUrl"),
      "conversationTimeline.linkedinProfileUrl"
    ),
    messages: parseProductPageAt(
      readRequired(record, "messages"),
      parseTimelineMessageView,
      "conversationTimeline.messages"
    ),
    ownership,
    pauseReason,
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    revision: parseRevision(
      readRequired(record, "revision"),
      "conversationTimeline.revision"
    ),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
    unknownOutcomes,
    updatedAt: parseUtcTimestamp(readRequired(record, "updatedAt")),
  });
}

export function parseConversationTimelineQuery(
  value: unknown
): ConversationTimelineQuery {
  const record = expectRecord(value, "conversationTimelineQuery");
  const kind = member(
    readRequired(record, "kind"),
    ["GET_CONVERSATION_TIMELINE"] as const,
    "conversationTimelineQuery.kind"
  );
  return Object.freeze({
    ...parseConversationSelector(record),
    kind,
    page: parsePageRequest(readRequired(record, "page")),
  });
}

export function parseConversationTimelineViewState(
  value: unknown
): ProductViewState<ConversationTimelineView> {
  return parseProductViewState(value, parseConversationTimelineView);
}

export function parseBillingView(value: unknown): BillingView {
  const record = expectRecord(value, "billing");
  const status = member(
    readRequired(record, "status"),
    BILLING_SUBSCRIPTION_STATUSES,
    "billing.status"
  );
  const entitlement = member(
    readRequired(record, "entitlement"),
    BILLING_ENTITLEMENT_STATUSES,
    "billing.entitlement"
  );
  if (entitlement === "OUTBOUND_ENABLED" && status !== "ACTIVE") {
    throw new ContractValidationError(
      "outbound entitlement requires an active subscription"
    );
  }
  const cancelAtPeriodEnd = nullable(
    readRequired(record, "cancelAtPeriodEnd"),
    (input) => expectBoolean(input, "billing.cancelAtPeriodEnd")
  );
  return Object.freeze({
    cancelAtPeriodEnd,
    currentPeriodEnd: nullable(
      readRequired(record, "currentPeriodEnd"),
      parseUtcTimestamp
    ),
    entitlement,
    lastUpdatedAt: nullable(
      readRequired(record, "lastUpdatedAt"),
      parseUtcTimestamp
    ),
    revision: parseRevision(
      readRequired(record, "revision"),
      "billing.revision"
    ),
    status,
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseBillingQuery(value: unknown): BillingQuery {
  const record = expectRecord(value, "billingQuery");
  const kind = member(
    readRequired(record, "kind"),
    ["GET_BILLING"] as const,
    "billingQuery.kind"
  );
  return Object.freeze({ ...parseTenantSelector(record), kind });
}

export function parseBillingCommand(value: unknown): BillingCommand {
  const record = expectRecord(value, "billingCommand");
  const kind = member(
    readRequired(record, "kind"),
    ["START_CHECKOUT", "OPEN_BILLING_PORTAL"] as const,
    "billingCommand.kind"
  );
  return Object.freeze({
    ...parseTenantSelector(record),
    kind,
    returnTo: parseRelativeReturnPath(readRequired(record, "returnTo")),
  });
}

export function parseBillingRedirectView(value: unknown): BillingRedirectView {
  const record = expectRecord(value, "billingRedirect");
  const entitlementChanged = expectBoolean(
    readRequired(record, "entitlementChanged"),
    "billingRedirect.entitlementChanged"
  );
  if (entitlementChanged) {
    throw new ContractValidationError(
      "checkout and portal redirects cannot grant entitlement"
    );
  }
  return Object.freeze({
    entitlementChanged: false,
    expiresAt: nullable(readRequired(record, "expiresAt"), parseUtcTimestamp),
    operation: member(
      readRequired(record, "operation"),
      ["CHECKOUT", "PORTAL"] as const,
      "billingRedirect.operation"
    ),
    url: parseRedirectUrl(readRequired(record, "url"), "billingRedirect.url"),
  });
}

export function parseBillingViewState(
  value: unknown
): ProductViewState<BillingView> {
  return parseProductViewState(value, parseBillingView);
}

function parseMetricDateRangeAt(value: unknown, path: string): MetricDateRange {
  const record = expectRecord(value, path);
  const from = parseUtcTimestamp(readRequired(record, "from"));
  const to = parseUtcTimestamp(readRequired(record, "to"));
  const duration = Date.parse(to) - Date.parse(from);
  if (duration <= 0 || duration > 366 * 24 * 60 * 60 * 1000) {
    throw new ContractValidationError(
      `${path} must be a positive range no longer than 366 days`
    );
  }
  return Object.freeze({ from, to });
}

export function parseMetricDateRange(value: unknown): MetricDateRange {
  return parseMetricDateRangeAt(value, "metrics.range");
}

function parseMetricRate(value: unknown, path: string): number | null {
  if (isNull(value)) {
    return null;
  }
  if (!isNumber(value) || value < 0 || value > 1) {
    throw new ContractValidationError(`${path} must be between 0 and 1`);
  }
  return value;
}

export function parseMetricCounts(value: unknown): MetricCounts {
  const record = expectRecord(value, "metrics.counts");
  return Object.freeze({
    confirmedMessages: parseNonNegativeCount(
      readRequired(record, "confirmedMessages"),
      "metrics.counts.confirmedMessages"
    ),
    handovers: parseNonNegativeCount(
      readRequired(record, "handovers"),
      "metrics.counts.handovers"
    ),
    invitationsAccepted: parseNonNegativeCount(
      readRequired(record, "invitationsAccepted"),
      "metrics.counts.invitationsAccepted"
    ),
    invitationsSent: parseNonNegativeCount(
      readRequired(record, "invitationsSent"),
      "metrics.counts.invitationsSent"
    ),
    replies: parseNonNegativeCount(
      readRequired(record, "replies"),
      "metrics.counts.replies"
    ),
    unknownActions: parseNonNegativeCount(
      readRequired(record, "unknownActions"),
      "metrics.counts.unknownActions"
    ),
  });
}

export function parseMetricRates(value: unknown): MetricRates {
  const record = expectRecord(value, "metrics.rates");
  return Object.freeze({
    acceptanceRate: parseMetricRate(
      readRequired(record, "acceptanceRate"),
      "metrics.rates.acceptanceRate"
    ),
    handoverRate: parseMetricRate(
      readRequired(record, "handoverRate"),
      "metrics.rates.handoverRate"
    ),
    replyRate: parseMetricRate(
      readRequired(record, "replyRate"),
      "metrics.rates.replyRate"
    ),
  });
}

export function parseMetricSpend(value: unknown): MetricSpend {
  const record = expectRecord(value, "metrics.spend");
  const amountCents = nullable(readRequired(record, "amountCents"), (input) =>
    expectInteger(input, "metrics.spend.amountCents", 0, 10_000_000_000)
  );
  const currency = nullable(readRequired(record, "currency"), (input) =>
    member(input, ["EUR"] as const, "metrics.spend.currency")
  );
  if ((amountCents === null) !== (currency === null)) {
    throw new ContractValidationError(
      "metrics spend amount and currency must be known together"
    );
  }
  return Object.freeze({ amountCents, currency });
}

export function parseMetricsView(value: unknown): MetricsView {
  const record = expectRecord(value, "metrics");
  return Object.freeze({
    asOf: parseUtcTimestamp(readRequired(record, "asOf")),
    coverage: member(
      readRequired(record, "coverage"),
      METRICS_COVERAGE,
      "metrics.coverage"
    ),
    counts: parseMetricCounts(readRequired(record, "counts")),
    rates: parseMetricRates(readRequired(record, "rates")),
    range: parseMetricDateRangeAt(
      readRequired(record, "range"),
      "metrics.range"
    ),
    spend: parseMetricSpend(readRequired(record, "spend")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseMetricsQuery(value: unknown): MetricsQuery {
  const record = expectRecord(value, "metricsQuery");
  const kind = member(
    readRequired(record, "kind"),
    ["GET_METRICS"] as const,
    "metricsQuery.kind"
  );
  return Object.freeze({
    ...parseTenantSelector(record),
    kind,
    range: parseMetricDateRangeAt(
      readRequired(record, "range"),
      "metricsQuery.range"
    ),
  });
}

export function parseMetricsViewState(
  value: unknown
): ProductViewState<MetricsView> {
  return parseProductViewState(value, parseMetricsView);
}

export function parseProfileViewState(
  value: unknown
): ProductViewState<ProfileView> {
  return parseProductViewState(value, parseProfileView);
}

export function parseOnboardingViewState(
  value: unknown
): ProductViewState<OnboardingView> {
  return parseProductViewState(value, parseOnboardingView);
}

export function parseLinkedInConnectionViewState(
  value: unknown
): ProductViewState<LinkedInConnectionView> {
  return parseProductViewState(value, parseLinkedInConnectionView);
}

export function parseCampaignViewState(
  value: unknown
): ProductViewState<CampaignView> {
  return parseProductViewState(value, parseCampaignView);
}

export function parseStyleViewState(
  value: unknown
): ProductViewState<StyleView> {
  return parseProductViewState(value, parseStyleView);
}
