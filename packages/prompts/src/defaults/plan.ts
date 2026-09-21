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
  "MIGRATION",
  "ROLE_CHANGE",
  "PROSPECT_POST",
  "NONE",
] as const;

export type BuyingSignalKind = (typeof BUYING_SIGNAL_KINDS)[number];

export const SIGNAL_RELEVANCE = ["RELEVANT", "OFF_DOMAIN", "ABSENT"] as const;
export type SignalRelevance = (typeof SIGNAL_RELEVANCE)[number];

export type SequenceDraftingContext = Readonly<{
  audience: IcpAudience;
  dm2NewFact: string | null;
  dm3DifferentAngleFact: string | null;
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
      recruiterStaffingAngle: boolean;
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
    case "MIGRATION": {
      return "MIGRATION";
    }
    case "ROLE_CHANGE": {
      return "ROLE_CHANGE";
    }
    case "PROSPECT_POST": {
      return "PROSPECT_POST";
    }
  }

  signalKind satisfies never;
  throw new Error(`unsupported buying signal kind: ${String(signalKind)}`);
}

function hasFact(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function planDirectMessages(
  context: SequenceDraftingContext
): readonly PlannedStep[] {
  const dm1 = templateByHook(selectDm1Hook(context));
  const dm2 = templateByHook(
    hasFact(context.dm2NewFact) ? "DM2_NEW_FACT" : "DM2_NEUTRAL"
  );
  const dm3HasDistinctFact =
    hasFact(context.dm3DifferentAngleFact) &&
    (!hasFact(context.dm2NewFact) ||
      context.dm3DifferentAngleFact.trim().toLocaleLowerCase("fr") !==
        context.dm2NewFact.trim().toLocaleLowerCase("fr"));
  const dm3 = templateByHook(
    dm3HasDistinctFact ? "DM3_DIFFERENT_ANGLE" : "DM3_NEUTRAL"
  );

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
  const dm1Hook = selectDm1Hook(context);
  return Object.freeze({
    continueAutomatedOutreach: true,
    invitation: Object.freeze({
      allowsPitch: false,
      step: "INVITATION",
      template: INVITATION_TEMPLATE,
    }),
    kind: "SEQUENCE",
    promptVersion,
    recruiterStaffingAngle:
      context.audience === "RECRUITER_ESN" && dm1Hook === "RECRUITMENT",
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
