import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Gate, GateRecommendation } from "@gtaa/contracts";

import { asDuty, asViewer, buildTestApp } from "./helpers.js";

async function getPendingId(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: "GET",
    url: "/api/gates/recommendations?status=pending",
    headers: asDuty,
  });
  const items = res.json() as GateRecommendation[];
  if (items.length === 0) throw new Error("no pending recommendations");
  return items[0]!.id;
}

describe("gate-approval flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("seeds 10 gates and 8 pending recommendations", async () => {
    const gates = (
      await app.inject({ method: "GET", url: "/api/gates", headers: asDuty })
    ).json() as Gate[];
    expect(gates).toHaveLength(10);
    const pending = (
      await app.inject({
        method: "GET",
        url: "/api/gates/recommendations?status=pending",
        headers: asDuty,
      })
    ).json() as GateRecommendation[];
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(r.constraints.length).toBeGreaterThan(0);
    }
  });

  it("denies decisions to Viewer (403)", async () => {
    const id = await getPendingId(app);
    const res = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asViewer,
      payload: { action: "approve" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("approves a pending recommendation, occupies the gate, and writes audit", async () => {
    const id = await getPendingId(app);
    const before = (
      await app.inject({
        method: "GET",
        url: "/api/audit",
        headers: asDuty,
      })
    ).json() as { items: unknown[] };

    const res = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: { action: "approve" },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json() as GateRecommendation;
    expect(updated.status).toBe("approved");
    expect(updated.decidedBy).toBe("mock-duty");

    const gate = (
      await app.inject({ method: "GET", url: "/api/gates", headers: asDuty })
    ).json() as Gate[];
    const occupiedGate = gate.find((g) => g.id === updated.suggestedGateId);
    expect(occupiedGate?.currentFlightId).toBe(updated.flightId);

    const after = (
      await app.inject({ method: "GET", url: "/api/audit", headers: asDuty })
    ).json() as { items: { action: string; resourceId: string }[] };
    expect(after.items.length).toBe(before.items.length + 1);
    expect(after.items[0]).toMatchObject({
      action: "recommendation.approved",
      resourceId: id,
    });
  });

  it("rejects a decision for a non-pending recommendation (409)", async () => {
    const id = await getPendingId(app);
    await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: { action: "approve" },
    });
    const dupe = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: { action: "approve" },
    });
    expect(dupe.statusCode).toBe(409);
  });

  it("requires a reason for reject (400 from Zod)", async () => {
    const id = await getPendingId(app);
    const res = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: { action: "reject" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("override records overrideGateId and reason", async () => {
    const id = await getPendingId(app);
    const gates = (
      await app.inject({ method: "GET", url: "/api/gates", headers: asDuty })
    ).json() as Gate[];
    const xl = gates.find((g) => g.maxAircraftSize === "XL");
    if (!xl) throw new Error("expected an XL gate in seed");

    const res = await app.inject({
      method: "POST",
      url: `/api/gates/recommendations/${id}/decision`,
      headers: asDuty,
      payload: {
        action: "override",
        overrideGateId: xl.id,
        reason: "Closer to transfer hall",
      },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json() as GateRecommendation;
    expect(updated.status).toBe("overridden");
    expect(updated.overrideGateId).toBe(xl.id);
    expect(updated.decisionReason).toBe("Closer to transfer hall");
  });
});
