import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError, OperationsInsights } from "@gtaa/contracts";

import { generateOperationsInsights } from "../services/insights-service.js";

const InsightsQuery = z.object({
  lookbackHours: z.coerce.number().int().min(1).max(168).default(24),
});

const insightsRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/insights/operations",
    {
      schema: {
        tags: ["insights"],
        description:
          "Aggregated operational analytics from the Fabric Lakehouse. " +
          "Mocked in this demo — see services/insights-service.ts for the real query pattern.",
        querystring: InsightsQuery,
        response: { 200: OperationsInsights, 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return generateOperationsInsights(req.query.lookbackHours);
    }
  );
};

export default insightsRoutes;
