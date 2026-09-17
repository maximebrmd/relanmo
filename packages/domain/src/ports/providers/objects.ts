import type { TenantId } from "../../contracts/ids";
import type { UtcTimestamp } from "../../contracts/values";
import type {
  ProviderOperationContext,
  ProviderReadResult,
  ProviderWriteResult,
} from "./common";

export type AuthorizedObjectKey = Readonly<{
  /** The adapter prepends the tenant prefix; callers cannot supply one. */
  relativeKey: string;
  purpose: "IMPORT" | "PROFILE_ATTACHMENT" | "WRITING_SAMPLE";
}>;

export type PrivateObjectMetadataEntry = Readonly<{
  key: string;
  value: string;
}>;

export type PrivateObjectInput = Readonly<{
  content: Uint8Array;
  contentType: string;
  context: ProviderOperationContext;
  key: AuthorizedObjectKey;
  metadata: readonly PrivateObjectMetadataEntry[];
  tenantId: TenantId;
}>;

export type PrivateObject = Readonly<{
  contentType: string;
  key: AuthorizedObjectKey;
  observedAt: UtcTimestamp;
  sizeBytes: number;
  tenantId: TenantId;
}>;

export type PresignedReadInput = Readonly<{
  context: ProviderOperationContext;
  expiresInSeconds: number;
  key: AuthorizedObjectKey;
  tenantId: TenantId;
}>;

export type PresignedReadOperation = Readonly<{
  expiresAt: UtcTimestamp;
  key: AuthorizedObjectKey;
  method: "GET";
  tenantId: TenantId;
  url: string;
}>;

export type ObjectStoragePort = Readonly<{
  createPresignedRead: (
    input: PresignedReadInput
  ) => Promise<ProviderReadResult<PresignedReadOperation>>;
  putPrivateObject: (
    input: PrivateObjectInput
  ) => Promise<ProviderWriteResult<PrivateObject>>;
}>;
