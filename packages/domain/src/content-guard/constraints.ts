import type { ContentGuardConstraints } from "./types";

export type ConstraintFinding = Readonly<{
  code: "EMPTY_TEXT" | "TOO_SHORT" | "TOO_LONG" | "FORBIDDEN_PHRASE";
  detail: string;
}>;

/**
 * Deterministic length and forbidden-phrase bounds. Matching is a plain
 * case-insensitive substring check against the rendered text: this module
 * does not interpret the text, so a phrase embedded in prospect-supplied
 * content is scanned exactly like any other characters in the draft.
 */
export function findConstraintFindings(
  text: string,
  constraints: ContentGuardConstraints
): readonly ConstraintFinding[] {
  const findings: ConstraintFinding[] = [];
  const trimmedLength = text.trim().length;

  if (trimmedLength === 0) {
    findings.push({ code: "EMPTY_TEXT", detail: "draft text is empty" });
  } else if (trimmedLength < constraints.minLength) {
    findings.push({
      code: "TOO_SHORT",
      detail: `draft text is ${trimmedLength} characters, below the minimum of ${constraints.minLength}`,
    });
  }

  if (text.length > constraints.maxLength) {
    findings.push({
      code: "TOO_LONG",
      detail: `draft text is ${text.length} characters, above the maximum of ${constraints.maxLength}`,
    });
  }

  const lowerText = text.toLowerCase();
  for (const phrase of constraints.forbiddenPhrases) {
    const trimmedPhrase = phrase.trim();
    if (
      trimmedPhrase.length > 0 &&
      lowerText.includes(trimmedPhrase.toLowerCase())
    ) {
      findings.push({
        code: "FORBIDDEN_PHRASE",
        detail: `draft text contains a forbidden phrase: "${trimmedPhrase}"`,
      });
    }
  }

  return Object.freeze(findings);
}
