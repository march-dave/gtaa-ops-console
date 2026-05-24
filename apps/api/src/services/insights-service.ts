import type { OperationsInsights } from "@gtaa/contracts";

/**
 * Operations insights backed by a Microsoft Fabric Lakehouse.
 *
 * Production flow (real implementation):
 *   1. Fabric Lakehouse exposes a T-SQL endpoint:
 *      Server=tcp:gtaaops.datawarehouse.fabric.microsoft.com,1433;Database=ops_lakehouse
 *   2. Connect via @azure/identity ManagedIdentityCredential + tedious (or mssql).
 *      The Managed Identity on the App Service is granted Viewer role on the Lakehouse.
 *   3. Run the aggregate query below against Delta tables (parameterized on @lookback).
 *   4. Cache for 5 minutes — lakehouse queries are not sub-second and these
 *      KPIs do not need to be real-time. App Insights tracks cache hit rate.
 *
 * The mock below produces deterministic-ish numbers so the FE wires up
 * end-to-end without a real Fabric capacity (which requires F2+ SKU + days
 * to provision).
 *
 * See docs/adr/0008-fabric-lakehouse-integration.md.
 */
const LAKEHOUSE_NAME = "ops_lakehouse@gtaaops.fabric";

const SENSOR_NAMES: Record<string, string> = {
  "s-belt-t3-a": "Baggage belt T3-A",
  "s-belt-t1-d": "Baggage belt T1-D",
  "s-hvac-t3": "HVAC zone T3-N",
  "s-runway-06L": "Runway 06L friction",
  "s-fuel-apron-b": "Fuel pressure Apron B",
  "s-deice-tank-1": "De-icing tank 1",
};

const buildExecutedQuery = (lookbackHours: number): string =>
  `-- Fabric Lakehouse: ${LAKEHOUSE_NAME}
-- Executed via T-SQL endpoint with Managed Identity (no secrets)
DECLARE @lookback INT = ${lookbackHours};

SELECT
  /* forecast accuracy: % of hours where actual fell inside the P10-P90 band */
  CAST(SUM(IIF(actual_pax BETWEEN p10 AND p90, 1, 0)) AS FLOAT)
    / NULLIF(COUNT(*), 0)                                              AS forecast_accuracy_p50,

  /* override rate: % of ML recs operators didn't take as-is */
  CAST(SUM(IIF(decision IN ('rejected','overridden'), 1, 0)) AS FLOAT)
    / NULLIF(COUNT(*), 0)                                              AS override_rate,

  (SELECT COUNT(*) FROM dbo.cv_events
   WHERE detected_at >= DATEADD(hour, -@lookback, SYSUTCDATETIME()))   AS cv_alerts,

  (SELECT COUNT(*) FROM dbo.sensor_readings
   WHERE anomaly_score >= 0.55
     AND ts >= DATEADD(hour, -@lookback, SYSUTCDATETIME()))            AS sensor_anomalies

FROM dbo.gate_recommendation_outcomes
WHERE decided_at >= DATEADD(hour, -@lookback, SYSUTCDATETIME());`;

/**
 * Scale knobs that turn lookbackHours into believable numbers so the
 * dashboard reacts visibly when the operator changes the time window.
 */
const scaleFor = (lookbackHours: number) => {
  // CV alerts ≈ 9/hour at peak, 3/hour off-peak. Roughly 6/hour average.
  const cvPerHour = 6 + (Math.random() - 0.5) * 1.5;
  // Sensor anomalies ≈ 4/hour average.
  const sensorPerHour = 4 + (Math.random() - 0.5) * 1.2;
  // Forecast accuracy stabilizes around 0.87 with tighter range for longer windows.
  const accSpread = lookbackHours <= 6 ? 0.05 : lookbackHours <= 24 ? 0.03 : 0.015;
  // Override rate similar — converges with bigger sample.
  const ovrSpread = lookbackHours <= 6 ? 0.05 : lookbackHours <= 24 ? 0.03 : 0.015;
  return {
    cvAlerts: Math.max(1, Math.round(cvPerHour * lookbackHours)),
    sensorAnomalies: Math.max(1, Math.round(sensorPerHour * lookbackHours)),
    forecastAccuracy: 0.87 + (Math.random() - 0.5) * accSpread * 2,
    overrideRate: 0.18 + (Math.random() - 0.5) * ovrSpread * 2,
  };
};

export function generateOperationsInsights(
  lookbackHours: number
): OperationsInsights {
  const startedAt = process.hrtime.bigint();
  const scale = scaleFor(lookbackHours);

  // CV alerts by hour: only the last 24 buckets shown regardless of lookback
  // (representing the latest 24-hour window of the chosen lookback range).
  const cvAlertsByHour = Array.from({ length: 24 }, (_, hour) => {
    const isPeak = (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);
    const base = isPeak ? 12 : 4;
    const jitter = Math.floor(Math.random() * 6);
    return { hour, count: base + jitter };
  });

  const topAnomalousSensors = [
    "s-runway-06L",
    "s-belt-t3-a",
    "s-fuel-apron-b",
    "s-hvac-t3",
    "s-deice-tank-1",
  ]
    .map((id, i) => {
      const base = Math.round(scale.sensorAnomalies / (i + 2));
      return {
        sensorId: id,
        sensorName: SENSOR_NAMES[id] ?? id,
        anomalyCount: Math.max(1, base + Math.floor(Math.random() * 4)),
      };
    })
    .sort((a, b) => b.anomalyCount - a.anomalyCount);

  // Simulate a lakehouse query duration: scales loosely with lookbackHours.
  const baseLatency = 140 + lookbackHours * 3 + Math.random() * 80;
  const queryDurationMs = Math.round(baseLatency);

  // Use the simulated value, not real wall-clock, so demos look credible
  // regardless of host CPU jitter.
  void startedAt;

  return {
    generatedAt: new Date().toISOString(),
    source: "fabric-lakehouse" as const,
    // Always 'demo' until a real Fabric capacity is wired (see ADR 0008).
    // Promote to 'live' by replacing this branch with a real Lakehouse SQL call.
    mode: "demo" as const,
    lakehouseName: LAKEHOUSE_NAME,
    lookbackHours,
    queryDurationMs,
    executedQuery: buildExecutedQuery(lookbackHours),
    kpis: {
      forecastAccuracyP50: Number(scale.forecastAccuracy.toFixed(3)),
      recommendationOverrideRate: Number(scale.overrideRate.toFixed(3)),
      cvAlertsLast24h: scale.cvAlerts,
      sensorAnomaliesLast24h: scale.sensorAnomalies,
    },
    cvAlertsByHour,
    topAnomalousSensors,
  };
}
