import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError, SensorStatus } from "@gtaa/contracts";

import { generateSensorStatuses } from "../services/sensor-service.js";

const sensorRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/sensors/status",
    {
      schema: {
        tags: ["sensors"],
        description:
          "Snapshot of all sensors with latest value and server-computed anomaly score.",
        response: { 200: z.array(SensorStatus), 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return generateSensorStatuses();
    }
  );
};

export default sensorRoutes;
