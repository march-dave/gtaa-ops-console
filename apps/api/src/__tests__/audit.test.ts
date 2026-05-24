import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuditEvent, CvEvent, GateRecommendation } from "@gtaa/contracts";

import { asDuty, asOps, buildTestApp } from "./helpers.js";

describe("audit log", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns empty on a fresh instance", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/audit",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: AuditEvent[]; nextCursor: string | null };
    expect(body.items).toEqual([]);
  });

  it("records before/after snapshots with traceId", async () => {
    const rec = (
      await app.inject({
        method: "GET",
        url: "/api/gates/recommendations?status=pending",
        headers: asDuty,
      })
    ).json() as GateRecommendation[];
    const id = rec[0]!.id;

    const decision = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: { action: "approve" },
    });
    expect(decision.statusCode).toBe(200);
    const traceId = decision.headers["x-request-id"];

    const audit = (
      await app.inject({
        method: "GET",
        url: "/api/audit?resourceType=gate_recommendation",
        headers: asDuty,
      })
    ).json() as { items: AuditEvent[] };
    const event = audit.items.find((e) => e.resourceId === id);
    expect(event).toBeDefined();
    expect(event!.before).toMatchObject({ status: "pending" });
    expect(event!.after).toMatchObject({ status: "approved" });
    expect(event!.traceId).toBe(traceId);
  });

  it("filters by resourceType and actorId", async () => {
    const list = (
      await app.inject({
        method: "GET",
        url: "/api/cv-events?limit=5",
        headers: asOps,
      })
    ).json() as CvEvent[];
    const target = list.find((e) => e.status === "new");
    if (!target) throw new Error("expected cv event");
    await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asOps,
      payload: { action: "acknowledge" },
    });

    const ops = (
      await app.inject({
        method: "GET",
        url: "/api/audit?actorId=mock-ops",
        headers: asDuty,
      })
    ).json() as { items: AuditEvent[] };
    expect(ops.items.every((e) => e.actorId === "mock-ops")).toBe(true);

    const cvOnly = (
      await app.inject({
        method: "GET",
        url: "/api/audit?resourceType=cv_event",
        headers: asDuty,
      })
    ).json() as { items: AuditEvent[] };
    expect(cvOnly.items.every((e) => e.resourceType === "cv_event")).toBe(true);
  });
});
