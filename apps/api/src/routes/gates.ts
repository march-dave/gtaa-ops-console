import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ApiError,
  ApprovalActionInput,
  Flight,
  Gate,
  GateRecommendation,
  RecommendationListQuery,
} from "@gtaa/contracts";

import { applyDecisionEffects } from "../services/gate-recommendation-service.js";

const ParamsId = z.object({ id: z.string().min(1) });

const gateRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/gates",
    {
      schema: {
        tags: ["gates"],
        description: "List all gates with current occupancy.",
        response: { 200: z.array(Gate), 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return app.store.listGates();
    }
  );

  typed.get(
    "/api/flights",
    {
      schema: {
        tags: ["gates"],
        description: "List scheduled flights (next ~6 hours of demo data).",
        response: { 200: z.array(Flight), 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return app.store.listFlights();
    }
  );

  typed.get(
    "/api/gates/recommendations",
    {
      schema: {
        tags: ["gates"],
        description: "List ML gate-allocation recommendations, optionally filtered.",
        querystring: RecommendationListQuery,
        response: { 200: z.array(GateRecommendation), 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      const { status, terminal } = req.query;
      return app.store.listRecommendations({
        ...(status !== undefined ? { status } : {}),
        ...(terminal !== undefined ? { terminal } : {}),
      });
    }
  );

  typed.post(
    "/api/gates/recommendations/:id/decision",
    {
      schema: {
        tags: ["gates"],
        description:
          "Approve, reject, or override a gate-allocation recommendation. " +
          "Requires DutyManager role. Every decision is written to the audit log.",
        params: ParamsId,
        body: ApprovalActionInput,
        response: {
          200: GateRecommendation,
          400: ApiError,
          401: ApiError,
          403: ApiError,
          404: ApiError,
          409: ApiError,
        },
      },
    },
    async (req, reply) => {
      const user = app.requireRole(req, "DutyManager");
      const existing = app.store.getRecommendation(req.params.id);
      if (!existing) throw app.httpErrors.notFound("Recommendation not found");
      if (existing.status !== "pending") {
        throw app.httpErrors.conflict(
          `Recommendation already ${existing.status}`
        );
      }

      const decision = req.body;
      if (decision.action === "override") {
        const targetGate = app.store.getGate(decision.overrideGateId);
        if (!targetGate) {
          throw app.httpErrors.badRequest("overrideGateId references an unknown gate");
        }
      }

      const updated = applyDecisionEffects(existing, user.id, decision);
      app.store.upsertRecommendation(updated);

      if (updated.status === "approved") {
        app.store.setGateCurrentFlight(updated.suggestedGateId, updated.flightId);
      } else if (updated.status === "overridden" && updated.overrideGateId) {
        app.store.setGateCurrentFlight(updated.overrideGateId, updated.flightId);
      }

      const actionMap = {
        approved: "recommendation.approved" as const,
        rejected: "recommendation.rejected" as const,
        overridden: "recommendation.overridden" as const,
      };
      const action = actionMap[updated.status as keyof typeof actionMap];

      app.audit.record({
        actorId: user.id,
        actorDisplayName: user.displayName,
        actorRole: user.roles[0]!,
        action,
        resourceType: "gate_recommendation",
        resourceId: updated.id,
        before: existing,
        after: updated,
        reason: updated.decisionReason,
        traceId: req.id,
      });

      reply.code(200);
      return updated;
    }
  );
};

export default gateRoutes;
