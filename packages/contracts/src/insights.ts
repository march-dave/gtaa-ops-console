import { z } from "zod";
import { IsoDateTime } from "./common.js";

export const OperationsInsightsKpis = z.object({
  forecastAccuracyP50: z
    .number()
    .min(0)
    .max(1)
    .describe("Share of hours where actual passenger volume fell within the P10–P90 band"),
  recommendationOverrideRate: z
    .number()
    .min(0)
    .max(1)
    .describe("Share of ML gate recommendations that were overridden by an operator"),
  cvAlertsLast24h: z.number().int().nonnegative(),
  sensorAnomaliesLast24h: z.number().int().nonnegative(),
});
export type OperationsInsightsKpis = z.infer<typeof OperationsInsightsKpis>;

export const CvAlertHourBucket = z.object({
  hour: z.number().int().min(0).max(23),
  count: z.number().int().nonnegative(),
});

export const TopAnomalousSensor = z.object({
  sensorId: z.string(),
  sensorName: z.string(),
  anomalyCount: z.number().int().nonnegative(),
});

export const InsightsMode = z.enum(["demo", "live"]);
export type InsightsMode = z.infer<typeof InsightsMode>;

export const OperationsInsights = z.object({
  generatedAt: IsoDateTime,
  source: z.literal("fabric-lakehouse"),
  mode: InsightsMode.describe(
    "'demo' = mock data shaped like a Fabric Lakehouse response; 'live' = real Lakehouse query"
  ),
  lakehouseName: z.string(),
  lookbackHours: z.number().int().min(1),
  queryDurationMs: z
    .number()
    .int()
    .nonnegative()
    .describe("Server-measured time to execute the aggregate query"),
  executedQuery: z
    .string()
    .describe("The parameterized T-SQL that ran (or would run) against the Lakehouse"),
  kpis: OperationsInsightsKpis,
  cvAlertsByHour: z.array(CvAlertHourBucket),
  topAnomalousSensors: z.array(TopAnomalousSensor),
});
export type OperationsInsights = z.infer<typeof OperationsInsights>;
