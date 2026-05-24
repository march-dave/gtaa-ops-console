import { z } from "zod";
import { IsoDateTime } from "./common.js";

export const Terminal = z.enum(["T1", "T3"]);
export type Terminal = z.infer<typeof Terminal>;

export const ForecastPoint = z.object({
  timestamp: IsoDateTime,
  p10: z.number().int().nonnegative(),
  p50: z.number().int().nonnegative(),
  p90: z.number().int().nonnegative(),
});
export type ForecastPoint = z.infer<typeof ForecastPoint>;

export const ForecastSeverity = z.enum(["info", "warn", "critical"]);

export const ForecastRecommendation = z.object({
  id: z.string(),
  severity: ForecastSeverity,
  title: z.string(),
  message: z.string(),
  suggestedAction: z.string(),
  forWindow: z.object({ start: IsoDateTime, end: IsoDateTime }),
});
export type ForecastRecommendation = z.infer<typeof ForecastRecommendation>;

export const PassengerFlowForecast = z.object({
  terminal: Terminal,
  generatedAt: IsoDateTime,
  modelVersion: z.string(),
  horizonHours: z.number().int().min(1).max(48),
  whatIfApplied: z
    .object({
      extraSecurityLanes: z.number().int().min(0).max(10).optional(),
      extraGates: z.number().int().min(0).max(10).optional(),
    })
    .nullable(),
  points: z.array(ForecastPoint),
  recommendations: z.array(ForecastRecommendation),
});
export type PassengerFlowForecast = z.infer<typeof PassengerFlowForecast>;

export const ForecastQuery = z.object({
  terminal: Terminal,
  horizonHours: z.coerce.number().int().min(1).max(48).default(24),
  extraSecurityLanes: z.coerce.number().int().min(0).max(10).optional(),
  extraGates: z.coerce.number().int().min(0).max(10).optional(),
});
export type ForecastQuery = z.infer<typeof ForecastQuery>;
