import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ApiError,
  CvActionInput,
  CvEvent,
  CvListQuery,
  type CvStreamEvent,
} from "@gtaa/contracts";

import { applyCvAction } from "../services/cv-service.js";

const ParamsId = z.object({ id: z.string().min(1) });

const cvRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/cv-events",
    {
      schema: {
        tags: ["cv"],
        description: "List recent CV events.",
        querystring: CvListQuery,
        response: { 200: z.array(CvEvent), 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return app.cv.list({
        ...(req.query.status !== undefined ? { status: req.query.status } : {}),
        limit: req.query.limit,
      });
    }
  );

  typed.post(
    "/api/cv-events/:id/action",
    {
      schema: {
        tags: ["cv"],
        description:
          "Acknowledge, escalate, or resolve a CV event. Requires DutyManager role.",
        params: ParamsId,
        body: CvActionInput,
        response: {
          200: CvEvent,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
        },
      },
    },
    async (req, reply) => {
      const user = app.requireRole(req, "DutyManager");
      const existing = app.cv.get(req.params.id);
      if (!existing) throw app.httpErrors.notFound("CV event not found");
      if (existing.status === "resolved") {
        throw app.httpErrors.conflict("CV event already resolved");
      }
      const updated = applyCvAction(existing, user.id, req.body);
      app.cv.upsert(updated);

      const actionMap = {
        acknowledge: "cv_event.acknowledged" as const,
        escalate: "cv_event.escalated" as const,
        resolve: "cv_event.resolved" as const,
      };
      app.audit.record({
        actorId: user.id,
        actorDisplayName: user.displayName,
        actorRole: user.roles[0]!,
        action: actionMap[req.body.action],
        resourceType: "cv_event",
        resourceId: updated.id,
        before: existing,
        after: updated,
        reason: req.body.action === "escalate" ? req.body.reason : null,
        traceId: req.id,
      });

      reply.code(200);
      return updated;
    }
  );

  // Server-Sent Events stream. Bypasses Fastify's normal serializer.
  app.get("/api/cv-events/stream", async (req, reply) => {
    app.requireAuth(req);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (msg: CvStreamEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    send({ type: "snapshot", events: app.cv.snapshot() });

    const unsubscribe = app.cv.subscribe(send);

    req.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });
};

export default cvRoutes;
