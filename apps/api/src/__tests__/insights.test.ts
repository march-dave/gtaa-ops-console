import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { OperationsInsights } from "@gtaa/contracts";

import { asDuty, buildTestApp } from "./helpers.js";

describe("insights — Fabric Lakehouse", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/insights/operations",
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns aggregated insights with source attribution", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/insights/operations?lookbackHours=24",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as OperationsInsights;
    expect(body.source).toBe("fabric-lakehouse");
    expect(body.lakehouseName).toContain("fabric");
    expect(body.lookbackHours).toBe(24);
    expect(body.cvAlertsByHour).toHaveLength(24);
    expect(body.topAnomalousSensors.length).toBeGreaterThan(0);
    expect(body.kpis.forecastAccuracyP50).toBeGreaterThan(0);
    expect(body.kpis.forecastAccuracyP50).toBeLessThanOrEqual(1);
    expect(body.kpis.recommendationOverrideRate).toBeGreaterThan(0);
    expect(body.kpis.recommendationOverrideRate).toBeLessThanOrEqual(1);
    expect(body.queryDurationMs).toBeGreaterThan(0);
    expect(body.executedQuery).toContain("DECLARE @lookback INT = 24");
    expect(body.mode).toBe("demo");
  });

  it("scales totals with the lookback window", async () => {
    const oneHour = (
      await app.inject({
        method: "GET",
        url: "/api/insights/operations?lookbackHours=1",
        headers: asDuty,
      })
    ).json() as OperationsInsights;
    const week = (
      await app.inject({
        method: "GET",
        url: "/api/insights/operations?lookbackHours=168",
        headers: asDuty,
      })
    ).json() as OperationsInsights;
    expect(week.kpis.cvAlertsLast24h).toBeGreaterThan(oneHour.kpis.cvAlertsLast24h);
    expect(week.kpis.sensorAnomaliesLast24h).toBeGreaterThan(
      oneHour.kpis.sensorAnomaliesLast24h
    );
    expect(week.executedQuery).toContain("DECLARE @lookback INT = 168");
  });

  it("validates lookbackHours range (rejects > 168)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/insights/operations?lookbackHours=999",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
