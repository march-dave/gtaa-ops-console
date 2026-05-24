import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { SensorStatus } from "@gtaa/contracts";

import { asDuty, buildTestApp } from "./helpers.js";

describe("sensors", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const res = await app.inject({ method: "GET", url: "/api/sensors/status" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a status snapshot for all sensors", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sensors/status",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json() as SensorStatus[];
    expect(items.length).toBeGreaterThan(0);
    for (const s of items) {
      expect(s.sensor.id).toBeTypeOf("string");
      expect(s.sensor.name).toBeTypeOf("string");
      expect(s.sensor.unit).toBeTypeOf("string");
      expect(["ok", "warn", "alert", "offline"]).toContain(s.status);
      expect(s.recentReadings.length).toBeGreaterThan(0);
      if (s.anomalyScore !== null) {
        expect(s.anomalyScore).toBeGreaterThanOrEqual(0);
        expect(s.anomalyScore).toBeLessThanOrEqual(1);
      }
    }
  });

  it("anomaly score and status agree (>=0.7 → alert, >=0.4 → warn, else ok)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/sensors/status",
      headers: asDuty,
    });
    const items = res.json() as SensorStatus[];
    for (const s of items) {
      if (s.anomalyScore === null) continue;
      if (s.anomalyScore >= 0.7) expect(s.status).toBe("alert");
      else if (s.anomalyScore >= 0.4) expect(s.status).toBe("warn");
      else expect(s.status).toBe("ok");
    }
  });
});
