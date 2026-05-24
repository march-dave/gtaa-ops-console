import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { EmbedToken } from "@gtaa/contracts";

import { asDuty, buildTestApp } from "./helpers.js";

describe("reports — Power BI embed token", () => {
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
      method: "POST",
      url: "/api/reports/embed-token",
      payload: { reportId: "demo-kpi-report" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an empty reportId (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/embed-token",
      headers: asDuty,
      payload: { reportId: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns a mock embed token in demo mode (no Power BI config)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/embed-token",
      headers: asDuty,
      payload: { reportId: "demo-kpi-report" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as EmbedToken;
    expect(body.reportId).toBe("demo-kpi-report");
    expect(body.embedUrl).toMatch(/^https:\/\/app\.powerbi\.com\//);
    expect(body.token).toMatch(/MOCK|mock/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
