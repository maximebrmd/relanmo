import { LEAD_AGENT_SKILLS_SOURCE } from "@relanmo/prompts/defaults";
import {
  EVALUATION_FIXTURES,
  evaluateFixture,
  evaluationFixtureById,
} from "@relanmo/prompts/fixtures";
import { describe, expect, it } from "vitest";

const REQUIRED_IDS = [
  "decision-maker-hiring",
  "recruiter-esn",
  "no-signal",
  "historical-reply",
] as const;

describe("French message evaluation fixtures", () => {
  it("includes the four required synthetic cases with source traces", () => {
    const ids = EVALUATION_FIXTURES.map((fixture) => fixture.id);
    expect(ids).toEqual([...REQUIRED_IDS]);

    for (const fixture of EVALUATION_FIXTURES) {
      for (const source of Object.values(fixture.ruleSources)) {
        if (source === null) {
          continue;
        }
        expect(source.revision).toBe(LEAD_AGENT_SKILLS_SOURCE.revision);
        expect(source.path.length).toBeGreaterThan(0);
      }
      expect(fixture.ruleSources.dm1Hook === null).toBe(
        fixture.expected.dm1Hook === null
      );
      expect(fixture.ruleSources.replyStop === null).toBe(
        fixture.expected.ownership !== "HUMAN_OWNED"
      );
      expect(fixture.prospect.fullName.length).toBeGreaterThan(0);
      expect(fixture.prospect.company.includes("Inc")).toBe(false);
      expect(fixture.expected.hiringSignalRequired).toBe(false);
    }
  });

  it("matches each fixture's documented expected outcome", () => {
    for (const fixture of EVALUATION_FIXTURES) {
      expect(evaluateFixture(fixture), fixture.id).toEqual(fixture.expected);
    }
  });

  it("lets a no-signal ICP complete the sequence", () => {
    const actual = evaluateFixture(evaluationFixtureById("no-signal"));
    expect(actual.icpEligible).toBe(true);
    expect(actual.dm1Hook).toBe("NEUTRAL");
    expect(actual.sequenceSteps).toEqual([
      "INVITATION",
      "DM1",
      "DM2",
      "DM3",
      "DM4",
      "DM5",
    ]);
  });

  it("derives the planning audience from ICP qualification", () => {
    const fixture = evaluationFixtureById("recruiter-esn");
    expect(() =>
      evaluateFixture({
        ...fixture,
        prospect: {
          ...fixture.prospect,
          headline: "Business Dev @ Product SaaS",
        },
      })
    ).toThrow("fixture recruiter-esn is not ICP eligible");
  });

  it("keeps a historical reply under human ownership with no further DMs", () => {
    const actual = evaluateFixture(evaluationFixtureById("historical-reply"));
    expect(actual.ownership).toBe("HUMAN_OWNED");
    expect(actual.continueAutomatedOutreach).toBe(false);
    expect(actual.sequenceSteps).toEqual([]);
    expect(actual.icpEligible).toBe(true);
  });
});
