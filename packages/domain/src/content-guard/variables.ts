export type VariableFinding = Readonly<{
  code: "UNRESOLVED_VARIABLE" | "LEAKED_PLACEHOLDER";
  detail: string;
}>;

/**
 * Detects template placeholder syntax that should never survive into a
 * final rendered draft. A canonical `{{name}}` occurrence is UNRESOLVED_VARIABLE
 * when `name` is a variable the composer was allowed to use (a substitution
 * that should have happened but did not) and LEAKED_PLACEHOLDER when it is
 * not (an unrecognized token, e.g. leaked raw template/prompt syntax). Any
 * stray unmatched brace left after removing canonical matches is also a
 * LEAKED_PLACEHOLDER. Prospect-supplied text is scanned by this same
 * character-level pattern like any other draft text; it is never treated as
 * an instruction or evaluated for its content.
 */
export function findVariableFindings(
  text: string,
  knownVariableNames: readonly string[]
): readonly VariableFinding[] {
  const known = new Set(knownVariableNames);
  const findings: VariableFinding[] = [];

  for (const match of text.matchAll(
    /\{\{\s*(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/gu
  )) {
    const name = match.groups?.name ?? "";
    findings.push(
      known.has(name)
        ? {
            code: "UNRESOLVED_VARIABLE",
            detail: `unresolved template variable {{${name}}}`,
          }
        : {
            code: "LEAKED_PLACEHOLDER",
            detail: `unrecognized placeholder {{${name}}} is not an approved template variable`,
          }
    );
  }

  const withoutCanonicalMatches = text.replaceAll(
    /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/gu,
    ""
  );
  if (/[{}]/u.test(withoutCanonicalMatches)) {
    findings.push({
      code: "LEAKED_PLACEHOLDER",
      detail: "unmatched template brace found outside a resolved variable",
    });
  }

  return Object.freeze(findings);
}
