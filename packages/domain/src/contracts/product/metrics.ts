import type { TenantId } from "../ids";
import type { UtcTimestamp } from "../values";
import type { ProductViewState, TenantSelector } from "./common";

export type MetricDateRange = Readonly<{
  from: UtcTimestamp;
  to: UtcTimestamp;
}>;

export type MetricCounts = Readonly<{
  confirmedMessages: number;
  handovers: number;
  invitationsAccepted: number;
  invitationsSent: number;
  replies: number;
  unknownActions: number;
}>;

export type MetricRates = Readonly<{
  acceptanceRate: number | null;
  handoverRate: number | null;
  replyRate: number | null;
}>;

export type MetricSpend = Readonly<{
  amountCents: number | null;
  currency: "EUR" | null;
}>;

export const METRICS_COVERAGE = ["COMPLETE", "PARTIAL", "UNKNOWN"] as const;
export type MetricsCoverage = (typeof METRICS_COVERAGE)[number];

export type MetricsView = Readonly<{
  asOf: UtcTimestamp;
  coverage: MetricsCoverage;
  counts: MetricCounts;
  rates: MetricRates;
  range: MetricDateRange;
  spend: MetricSpend;
  tenantId: TenantId;
}>;

export type MetricsQuery = Readonly<
  TenantSelector & {
    kind: "GET_METRICS";
    range: MetricDateRange;
  }
>;

export type MetricsViewResult = ProductViewState<MetricsView>;

export type MetricsQueryHandler = (
  query: MetricsQuery
) => Promise<MetricsViewResult>;
