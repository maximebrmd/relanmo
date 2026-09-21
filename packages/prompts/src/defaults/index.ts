export const promptDefaultsSurface = "french-v1" as const;

export {
  classifyIcpAudience,
  detectOnMarketIntent,
  ICP_AUDIENCES,
  ICP_EXCLUSIONS,
  qualifyIcp,
} from "./icp";
export type {
  IcpAudience,
  IcpExclusion,
  IcpProspectFacts,
  IcpQualification,
} from "./icp";
export {
  frenchDefaultPromptVersion,
  invitationHasNote,
  planFrenchSequence,
  plannedSequenceSteps,
  selectDm1Hook,
  BUYING_SIGNAL_KINDS,
  SIGNAL_RELEVANCE,
} from "./plan";
export type {
  BuyingSignalKind,
  FrenchSequencePlan,
  PlannedStep,
  SequenceDraftingContext,
  SignalRelevance,
} from "./plan";
export { LEAD_AGENT_SKILLS_SOURCE, ruleSource } from "./source";
export type { LeadAgentRuleSource, LeadAgentSkillName } from "./source";
export {
  ALLOWED_TEMPLATE_VARIABLES,
  DM1_HOOKS,
  FOLLOW_UP_HOOKS,
  FRENCH_WRITING_DEFAULTS,
  INVITATION_TEMPLATE,
  MESSAGE_TEMPLATES,
  templateByHook,
} from "./templates";
export type {
  AllowedTemplateVariable,
  Dm1Hook,
  FollowUpHook,
  MessageHook,
  MessageTemplate,
} from "./templates";
