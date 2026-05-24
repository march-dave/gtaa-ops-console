import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { CvEvent } from "@gtaa/contracts";

import { asDuty, asViewer, buildTestApp } from "./helpers.js";

describe("cv-events flow", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns a non-empty initial backlog (ticker disabled in test)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/cv-events?limit=20",
      headers: asDuty,
    });
    expect(res.statusCode).toBe(200);
    const events = res.json() as CvEvent[];
    expect(events.length).toBeGreaterThan(0);
    // Sorted newest-first.
    for (let i = 0; i < events.length - 1; i += 1) {
      expect(events[i]!.detectedAt >= events[i + 1]!.detectedAt).toBe(true);
    }
  });

  it("denies actions to Viewer (403)", async () => {
    const list = (
      await app.inject({
        method: "GET",
        url: "/api/cv-events?limit=1",
        headers: asDuty,
      })
    ).json() as CvEvent[];
    const id = list[0]!.id;
    const res = await app.inject({
      method: "POST",
      url: `/api/cv-events/${id}/action`,
      headers: asViewer,
      payload: { action: "acknowledge" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("acknowledge → audit row created with cv_event.acknowledged", async () => {
    const list = (
      await app.inject({
        method: "GET",
        url: "/api/cv-events?limit=10",
        headers: asDuty,
      })
    ).json() as CvEvent[];
    const target = list.find((e) => e.status === "new");
    if (!target) throw new Error("expected a new CV event");

    const before = (
      await app.inject({ method: "GET", url: "/api/audit", headers: asDuty })
    ).json() as { items: unknown[] };

    const res = await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asDuty,
      payload: { action: "acknowledge" },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json() as CvEvent;
    expect(updated.status).toBe("acknowledged");
    expect(updated.acknowledgedBy).toBe("mock-duty");

    const after = (
      await app.inject({ method: "GET", url: "/api/audit", headers: asDuty })
    ).json() as { items: { action: string; resourceType: string }[] };
    expect(after.items.length).toBe(before.items.length + 1);
    expect(after.items[0]).toMatchObject({
      action: "cv_event.acknowledged",
      resourceType: "cv_event",
    });
  });

  it("escalate requires a reason (400) and saves it on success", async () => {
    const list = (
      await app.inject({
        method: "GET",
        url: "/api/cv-events?limit=20",
        headers: asDuty,
      })
    ).json() as CvEvent[];
    const target = list.find((e) => e.status === "new");
    if (!target) throw new Error("expected a new event");

    const missing = await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asDuty,
      payload: { action: "escalate" },
    });
    expect(missing.statusCode).toBe(400);

    const ok = await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asDuty,
      payload: { action: "escalate", reason: "Confirming with ramp" },
    });
    expect(ok.statusCode).toBe(200);
    const updated = ok.json() as CvEvent;
    expect(updated.status).toBe("escalated");
    expect(updated.payload.notes).toContain("Confirming with ramp");
  });

  it("rejects actions on a resolved event (409)", async () => {
    const list = (
      await app.inject({
        method: "GET",
        url: "/api/cv-events?limit=20",
        headers: asDuty,
      })
    ).json() as CvEvent[];
    const target = list.find((e) => e.status === "new");
    if (!target) throw new Error("expected a new event");

    await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asDuty,
      payload: { action: "resolve" },
    });

    const again = await app.inject({
      method: "POST",
      url: `/api/cv-events/${target.id}/action`,
      headers: asDuty,
      payload: { action: "acknowledge" },
    });
    expect(again.statusCode).toBe(409);
  });
});
