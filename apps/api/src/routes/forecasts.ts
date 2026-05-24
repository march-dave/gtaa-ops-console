import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  ApiError,
  ForecastQuery,
  PassengerFlowForecast,
} from "@gtaa/contracts";

import { generatePassengerFlowForecast } from "../services/forecast-service.js";

const forecastRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/forecasts/passenger-flow",
    {
      schema: {
        tags: ["forecasts"],
        description:
          "Synthetic passenger-flow forecast with P10/P50/P90 bands and recommendations. Accepts what-if controls.",
        querystring: ForecastQuery,
        response: { 200: PassengerFlowForecast, 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return generatePassengerFlowForecast(req.query);
    }
  );
};

export default forecastRoutes;
