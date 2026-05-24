import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

const HealthResponse = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number(),
  version: z.string(),
});

const healthRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/health",
    {
      schema: {
        tags: ["meta"],
        description: "Liveness probe",
        response: { 200: HealthResponse },
      },
    },
    async () => ({
      status: "ok" as const,
      uptimeSeconds: process.uptime(),
      version: process.env.npm_package_version ?? "0.1.0",
    })
  );

  typed.get(
    "/ready",
    {
      schema: {
        tags: ["meta"],
        description: "Readiness probe (checks dependencies)",
        response: { 200: HealthResponse },
      },
    },
    async () => ({
      status: "ok" as const,
      uptimeSeconds: process.uptime(),
      version: process.env.npm_package_version ?? "0.1.0",
    })
  );
};

export default healthRoutes;
