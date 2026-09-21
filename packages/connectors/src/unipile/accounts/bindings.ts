import type { TenantId } from "@relanmo/domain/contracts";

export type UnipileAccountBindingResult =
  | "ALREADY_BOUND"
  | "BOUND"
  | "CONFLICT";

export type UnipileAccountDirectory = Readonly<{
  bind: (
    providerAccountId: string,
    tenantId: TenantId
  ) => Promise<UnipileAccountBindingResult> | UnipileAccountBindingResult;
}>;

export class MemoryUnipileAccountDirectory implements UnipileAccountDirectory {
  readonly #bindings = new Map<string, TenantId>();

  bind(
    providerAccountId: string,
    tenantId: TenantId
  ): UnipileAccountBindingResult {
    const existing = this.#bindings.get(providerAccountId);
    if (existing === undefined) {
      this.#bindings.set(providerAccountId, tenantId);
      return "BOUND";
    }
    if (existing === tenantId) {
      return "ALREADY_BOUND";
    }
    return "CONFLICT";
  }
}
