/**
 * Reviewed lead-agent-skills snapshot the French defaults were ported from.
 * The cadence and invitation-without-note rules in architecture.md cite this
 * same revision.
 */
export const LEAD_AGENT_SKILLS_SOURCE = Object.freeze({
  capturedAt: "2026-09-15T08:39:33.000Z",
  path: "https://github.com/maximebrmd/lead-agent-skills",
  revision: "f5060aac8dbf5550905d3c85f6099712d9f4cd8c",
});

export type LeadAgentSkillName = "dm" | "hunt" | "setup";

export type LeadAgentRuleSource = Readonly<{
  path: string;
  revision: string;
  skill: LeadAgentSkillName;
}>;

export function ruleSource(
  skill: LeadAgentSkillName,
  path: string
): LeadAgentRuleSource {
  return Object.freeze({
    path,
    revision: LEAD_AGENT_SKILLS_SOURCE.revision,
    skill,
  });
}
