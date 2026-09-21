import type { PromptVersionRef, SequenceStep } from "@relanmo/domain/contracts";
import {
  parsePromptVersionId,
  parseUtcTimestamp,
} from "@relanmo/domain/contracts";

import type { IcpAudience } from "./icp";
import { LEAD_AGENT_SKILLS_SOURCE } from "./source";
import type { Dm1Hook, MessageTemplate } from "./templates";
import {
  FRENCH_WRITING_DEFAULTS,
  INVITATION_TEMPLATE,
  templateByHook,
} from "./templates";

export const BUYING_SIGNAL_KINDS = [
  "HIRING",
  "FUNDING",
  "INBOUND_COMMENT",
  "INBOUND_LIKE",
  "MIGRATION",
  "ROLE_CHANGE",
  "PROSPECT_POST",
  "NONE",
] as const;

export type BuyingSignalKind = (typeof BUYING_SIGNAL_KINDS)[number];

export const SIGNAL_RELEVANCE = ["RELEVANT", "OFF_DOMAIN", "ABSENT"] as const;
export type SignalRelevance = (typeof SIGNAL_RELEVANCE)[number];

export const DM2_FACT_KINDS = ["OFFER", "PROSPECT_POST", "RELEASE"] as const;
export type Dm2FactKind = (typeof DM2_FACT_KINDS)[number];

export const DM3_FACT_KINDS = ["PRODUCT", "SPEAKING"] as const;
export type Dm3FactKind = (typeof DM3_FACT_KINDS)[number];

type FollowUpFactRelevance = Exclude<SignalRelevance, "ABSENT">;

export type Dm2FollowUpFact = Readonly<{
  detail: string | null;
  evidenceId: string;
  fact: string;
  kind: Dm2FactKind;
  relevance: FollowUpFactRelevance;
}>;

export type Dm3FollowUpFact = Readonly<{
  detail: string | null;
  evidenceId: string;
  fact: string;
  kind: Dm3FactKind;
  relevance: FollowUpFactRelevance;
}>;

export type SequenceDraftingContext = Readonly<{
  audience: IcpAudience;
  dm2Fact: Dm2FollowUpFact | null;
  dm3Fact: Dm3FollowUpFact | null;
  incomingReplyPresent: boolean;
  signalKind: BuyingSignalKind;
  signalRelevance: SignalRelevance;
  verifiedSharedConnection: string | null;
}>;

export type PlannedStep = Readonly<{
  allowsPitch: false;
  step: SequenceStep;
  template: MessageTemplate;
}>;

const EMPTY_SEQUENCE_STEPS: readonly [] = Object.freeze([]);

export type FrenchSequencePlan =
  | Readonly<{
      continueAutomatedOutreach: true;
      invitation: PlannedStep;
      kind: "SEQUENCE";
      promptVersion: PromptVersionRef;
      steps: readonly PlannedStep[];
    }>
  | Readonly<{
      continueAutomatedOutreach: false;
      invitation: null;
      kind: "STOPPED";
      promptVersion: PromptVersionRef;
      reason: "INCOMING_REPLY";
      steps: readonly [];
    }>;

export function frenchDefaultPromptVersion(): PromptVersionRef {
  return Object.freeze({
    createdAt: parseUtcTimestamp(LEAD_AGENT_SKILLS_SOURCE.capturedAt),
    id: parsePromptVersionId("prompt_default_fr_v1"),
    kind: "PROMPT_DEFAULT",
    revision: 1,
  });
}

/**
 * A hiring signal is used only to choose the DM1 angle. Shared-connection
 * wording requires a verified mutual; otherwise the full sequence uses a
 * fact-safe neutral opener.
 */
export function selectDm1Hook(context: SequenceDraftingContext): Dm1Hook {
  const neutralHook =
    context.verifiedSharedConnection === null ||
    context.verifiedSharedConnection.trim().length === 0
      ? "NEUTRAL"
      : "SHARED_CONNECTION";

  if (context.signalRelevance !== "RELEVANT") {
    return neutralHook;
  }

  const { signalKind } = context;
  switch (signalKind) {
    case "NONE": {
      return neutralHook;
    }
    case "HIRING": {
      return "RECRUITMENT";
    }
    case "FUNDING": {
      return "FUNDING";
    }
    case "INBOUND_COMMENT": {
      return "INBOUND_COMMENT";
    }
    case "INBOUND_LIKE": {
      return "INBOUND_LIKE";
    }
    case "MIGRATION": {
      return "MIGRATION";
    }
    case "ROLE_CHANGE": {
      return "ROLE_CHANGE";
    }
    case "PROSPECT_POST": {
      return "PROSPECT_POST";
    }
    default: {
      signalKind satisfies never;
      throw new Error(`unsupported buying signal kind: ${String(signalKind)}`);
    }
  }
}

function hasFact(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function selectDm2Hook(context: SequenceDraftingContext) {
  const { dm2Fact } = context;
  if (
    dm2Fact === null ||
    dm2Fact.relevance !== "RELEVANT" ||
    !hasFact(dm2Fact.evidenceId) ||
    !hasFact(dm2Fact.fact) ||
    (dm2Fact.kind === "PROSPECT_POST" && !hasFact(dm2Fact.detail))
  ) {
    return "DM2_NEUTRAL" as const;
  }

  const { kind } = dm2Fact;
  switch (kind) {
    case "OFFER": {
      return "DM2_OFFER" as const;
    }
    case "PROSPECT_POST": {
      return "DM2_PROSPECT_POST" as const;
    }
    case "RELEASE": {
      return "DM2_RELEASE" as const;
    }
    default: {
      kind satisfies never;
      throw new Error(`unsupported DM2 fact kind: ${String(kind)}`);
    }
  }
}

function selectDm3Hook(context: SequenceDraftingContext) {
  const { dm2Fact, dm3Fact } = context;
  const repeatsDm2Fact =
    dm2Fact !== null &&
    dm3Fact !== null &&
    dm3Fact.evidenceId.trim() === dm2Fact.evidenceId.trim();
  if (
    dm3Fact === null ||
    dm3Fact.relevance !== "RELEVANT" ||
    !hasFact(dm3Fact.evidenceId) ||
    !hasFact(dm3Fact.fact) ||
    repeatsDm2Fact ||
    (dm3Fact.kind === "SPEAKING" && !hasFact(dm3Fact.detail))
  ) {
    return "DM3_NEUTRAL" as const;
  }

  const { kind } = dm3Fact;
  switch (kind) {
    case "PRODUCT": {
      return "DM3_PRODUCT" as const;
    }
    case "SPEAKING": {
      return "DM3_SPEAKING" as const;
    }
    default: {
      kind satisfies never;
      throw new Error(`unsupported DM3 fact kind: ${String(kind)}`);
    }
  }
}

function planDirectMessages(
  context: SequenceDraftingContext
): readonly PlannedStep[] {
  const dm1 = templateByHook(selectDm1Hook(context));
  const dm2 = templateByHook(selectDm2Hook(context));
  const dm3 = templateByHook(selectDm3Hook(context));

  return Object.freeze([
    Object.freeze({
      allowsPitch: false,
      step: dm1.step,
      template: dm1,
    }),
    Object.freeze({
      allowsPitch: false,
      step: dm2.step,
      template: dm2,
    }),
    Object.freeze({
      allowsPitch: false,
      step: dm3.step,
      template: dm3,
    }),
    Object.freeze({
      allowsPitch: false,
      step: "DM4" as const,
      template: templateByHook("DM4_LIGHT_NUDGE"),
    }),
    Object.freeze({
      allowsPitch: false,
      step: "DM5" as const,
      template: templateByHook("DM5_CLOSE"),
    }),
  ]);
}

/**
 * Versioned French sequence defaults. An incoming prospect message stops
 * automated drafting; invitation stays without a note; DM1–DM5 stay
 * available without a hiring signal.
 */
export function planFrenchSequence(
  context: SequenceDraftingContext
): FrenchSequencePlan {
  const promptVersion = frenchDefaultPromptVersion();

  if (context.incomingReplyPresent) {
    return Object.freeze({
      continueAutomatedOutreach: false,
      invitation: null,
      kind: "STOPPED",
      promptVersion,
      reason: "INCOMING_REPLY",
      steps: EMPTY_SEQUENCE_STEPS,
    });
  }

  const steps = planDirectMessages(context);
  return Object.freeze({
    continueAutomatedOutreach: true,
    invitation: Object.freeze({
      allowsPitch: false,
      step: "INVITATION",
      template: INVITATION_TEMPLATE,
    }),
    kind: "SEQUENCE",
    promptVersion,
    steps,
  });
}

export function plannedSequenceSteps(
  plan: FrenchSequencePlan
): readonly SequenceStep[] {
  if (plan.kind === "STOPPED") {
    return Object.freeze([]);
  }

  return Object.freeze([
    plan.invitation.step,
    ...plan.steps.map((step) => step.step),
  ]);
}

export function invitationHasNote(plan: FrenchSequencePlan): boolean {
  if (plan.kind === "STOPPED") {
    return FRENCH_WRITING_DEFAULTS.invitationHasNote;
  }
  return plan.invitation.template.body.length > 0;
}
