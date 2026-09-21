import type { TenantId } from "@relanmo/domain/contracts";

export type UnipileAccountDirectory = Readonly<{
  isAuthorized: (
    providerAccountId: string,
    tenantId: TenantId
  ) => Promise<boolean> | boolean;
}>;
