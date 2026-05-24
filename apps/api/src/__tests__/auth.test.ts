import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { asDuty, asOps, asViewer, buildTestApp } from "./helpers.js";

describe("auth", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without a mock user header", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    const body = res.json() as { code: string; traceId?: string };
    expect(body.code).toBe("CLIENT_ERROR");
    expect(body.traceId).toBeDefined();
  });

  it("returns the mock user with the X-Mock-User header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: "mock-duty",
      roles: ["DutyManager"],
    });
  });

  it("supports a mockUser query param (for SSE)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me?mockUser=ops",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ roles: ["OpsManager"] });
  });

  it("returns the right role for each mock user", async () => {
    for (const [header, expected] of [
      [asViewer, "Viewer"],
      [asDuty, "DutyManager"],
      [asOps, "OpsManager"],
    ] as const) {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: header,
      });
      expect(res.json()).toMatchObject({ roles: [expected] });
    }
  });
});
