export {
  createTypeSafeDecisionPort,
  TYPESAFE_ADAPTER_LIMITS,
} from "./decision-port";
export type {
  TypeSafeDecisionAdapter,
  TypeSafeDecisionBatch,
  TypeSafeDecisionPortOptions,
  TypeSafeDependentDecisionInput,
  TypeSafeIndependentDecisionInput,
  TypeSafeSystemOneClient,
} from "./decision-port";
export { VERSION as typeSafeSdkVersion } from "@typesafe-ai/sdk";

export const typeSafeSurface = "node-portable-server" as const;
