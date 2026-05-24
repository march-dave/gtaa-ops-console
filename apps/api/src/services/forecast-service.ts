import { randomUUID } from "node:crypto";
import type {
  ForecastQuery,
  ForecastRecommendation,
  PassengerFlowForecast,
} from "@gtaa/contracts";

const MODEL_VERSION = "passenger-flow-v0.3.0-synth";

const HOURLY_PATTERN = [
  0.2, 0.15, 0.12, 0.1, 0.12, 0.25, 0.55, 0.85, 0.92, 0.88, 0.78, 0.72, 0.74,
  0.78, 0.82, 0.9, 0.95, 0.92, 0.84, 0.72, 0.6, 0.5, 0.4, 0.3,
];

const BASE_LOAD: Record<"T1" | "T3", number> = {
  T1: 1800,
  T3: 2400,
};

/** Pure function: same query => same forecast (deterministic for demo). */
export function generatePassengerFlowForecast(
  query: ForecastQuery
): PassengerFlowForecast {
  const now = new Date();
  now.setMinutes(0, 0, 0);

  const securityRelief = (query.extraSecurityLanes ?? 0) * 0.04;
  const gateRelief = (query.extraGates ?? 0) * 0.03;
  const reliefFactor = Math.min(0.4, securityRelief + gateRelief);

  const base = BASE_LOAD[query.terminal];
  const points: PassengerFlowForecast["points"] = [];
  let peakHourIdx: number | null = null;
  let peakP90 = 0;

  for (let h = 0; h < query.horizonHours; h += 1) {
    const ts = new Date(now.getTime() + h * 3_600_000);
    const hourOfDay = ts.getHours();
    const pattern = HOURLY_PATTERN[hourOfDay]!;
    const expected = Math.round(base * pattern * (1 - reliefFactor));
    const spread = Math.round(expected * 0.18);
    const p50 = expected;
    const p10 = Math.max(0, p50 - spread);
    const p90 = p50 + spread;
    if (p90 > peakP90) {
      peakP90 = p90;
      peakHourIdx = h;
    }
    points.push({
      timestamp: ts.toISOString(),
      p10,
      p50,
      p90,
    });
  }

  const recommendations: ForecastRecommendation[] = [];
  if (peakHourIdx !== null && peakP90 > base * 0.85 && reliefFactor < 0.1) {
    const peakPoint = points[peakHourIdx]!;
    const windowEnd = new Date(
      new Date(peakPoint.timestamp).getTime() + 3_600_000
    ).toISOString();
    recommendations.push({
      id: randomUUID(),
      severity: peakP90 > base * 1.0 ? "critical" : "warn",
      title: `${query.terminal} congestion forecast`,
      message: `Predicted P90 of ${peakP90} pax/hr at ${new Date(peakPoint.timestamp).toUTCString()}.`,
      suggestedAction:
        "Open one additional security lane and re-run the forecast to verify relief.",
      forWindow: { start: peakPoint.timestamp, end: windowEnd },
    });
  }

  const whatIf =
    query.extraSecurityLanes !== undefined || query.extraGates !== undefined
      ? {
          ...(query.extraSecurityLanes !== undefined
            ? { extraSecurityLanes: query.extraSecurityLanes }
            : {}),
          ...(query.extraGates !== undefined
            ? { extraGates: query.extraGates }
            : {}),
        }
      : null;

  return {
    terminal: query.terminal,
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    horizonHours: query.horizonHours,
    whatIfApplied: whatIf,
    points,
    recommendations,
  };
}
