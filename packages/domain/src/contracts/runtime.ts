/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- These helpers are the explicit boundary for untrusted provider and transport values. */

export type ContractIssue = Readonly<{
  path: string;
  message: string;
}>;

export class ContractValidationError extends Error {
  readonly issues: readonly ContractIssue[];

  constructor(message: string, issues?: readonly ContractIssue[]) {
    super(message);
    this.name = "ContractValidationError";
    this.issues = issues ?? Object.freeze([{ message, path: "value" }]);
  }
}

export type SafeParseFailure = Readonly<{
  success: false;
  issues: readonly ContractIssue[];
}>;

export type SafeParseSuccess<T> = Readonly<{
  data: T;
  success: true;
}>;

export type SafeParseResult<T> = SafeParseFailure | SafeParseSuccess<T>;

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isMember<const T extends readonly string[]>(
  value: string,
  allowed: T
): value is T[number] {
  return allowed.some((candidate) => candidate === value);
}

export function isNonEmpty<T>(
  values: readonly T[]
): values is readonly [T, ...T[]] {
  return values.length > 0;
}

export function expectRecord(
  value: unknown,
  path: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ContractValidationError(`${path} must be an object`);
  }
  return value;
}

export function expectString(value: unknown, path: string): string {
  if (!isString(value)) {
    throw new ContractValidationError(`${path} must be a string`);
  }
  return value;
}

export function expectNonEmptyString(value: unknown, path: string): string {
  const parsed = expectString(value, path);
  if (parsed.trim().length === 0) {
    throw new ContractValidationError(`${path} must not be empty`);
  }
  return parsed;
}

export function expectNullableString(
  value: unknown,
  path: string,
  allowEmpty = true
): string | null {
  if (isNull(value)) {
    return null;
  }

  const parsed = expectString(value, path);
  if (!allowEmpty && parsed.trim().length === 0) {
    throw new ContractValidationError(`${path} must not be empty`);
  }
  return parsed;
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (!isBoolean(value)) {
    throw new ContractValidationError(`${path} must be a boolean`);
  }
  return value;
}

export function expectInteger(
  value: unknown,
  path: string,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (!isNumber(value) || !Number.isInteger(value)) {
    throw new ContractValidationError(`${path} must be an integer`);
  }
  if (value < minimum || value > maximum) {
    throw new ContractValidationError(
      `${path} must be between ${minimum} and ${maximum}`
    );
  }
  return value;
}

export function expectArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ContractValidationError(`${path} must be an array`);
  }
  return value;
}

export function expectArrayOf<T>(
  value: unknown,
  parser: (item: unknown, path: string) => T,
  path: string,
  maximum = Number.MAX_SAFE_INTEGER
): readonly T[] {
  const values = expectArray(value, path);
  if (values.length > maximum) {
    throw new ContractValidationError(`${path} has too many items`);
  }
  return Object.freeze(
    values.map((item, index) => parser(item, `${path}[${index}]`))
  );
}

export function readRequired(record: Record<string, unknown>, key: string) {
  if (!Object.hasOwn(record, key)) {
    throw new ContractValidationError(`missing required field: ${key}`);
  }
  return record[key];
}

export function parseOpaqueString(value: unknown, path: string): string {
  const parsed = expectNonEmptyString(value, path);
  if (parsed.length > 128 || /[\s\\/]/u.test(parsed)) {
    throw new ContractValidationError(
      `${path} must be a compact opaque identifier without whitespace or path separators`
    );
  }
  return parsed;
}

export function safeParse<T>(
  parser: (input: unknown) => T,
  input: unknown
): SafeParseResult<T> {
  try {
    return Object.freeze({ data: parser(input), success: true });
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return Object.freeze({ issues: error.issues, success: false });
    }
    return Object.freeze({
      issues: Object.freeze([
        {
          message: "unexpected parser failure",
          path: "value",
        },
      ]),
      success: false,
    });
  }
}
