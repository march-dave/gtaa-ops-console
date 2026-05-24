import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import type { Config } from "./config.js";
import authPlugin from "./plugins/auth.js";
import auditPlugin from "./plugins/audit.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import storePlugin from "./plugins/store.js";
import cvStreamPlugin from "./plugins/cv-stream.js";
import staticWebPlugin from "./plugins/static-web.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import forecastRoutes from "./routes/forecasts.js";
import gateRoutes from "./routes/gates.js";
import cvRoutes from "./routes/cv-events.js";
import sensorRoutes from "./routes/sensors.js";
import reportsRoutes from "./routes/reports.js";
import insightsRoutes from "./routes/insights.js";
import auditRoutes from "./routes/audit.js";

export interface BuildAppOptions {
  config: Config;
}

export async function buildApp({ config }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development"
        ? {
            transport: {
              target: "pino-pretty",
              options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
            },
          }
        : {}),
    },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "traceId",
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
    exposedHeaders: ["x-request-id"],
  });

  await app.register(errorHandlerPlugin);
  await app.register(auditPlugin);
  await app.register(storePlugin);
  await app.register(cvStreamPlugin, {});
  await app.register(authPlugin, { config });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "GTAA Ops Console API",
        version: "0.1.0",
        description:
          "Decision-support console for airport operations. Forecasts, gate-allocation recommendations, CV alerts, sensor analytics, audit.",
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(forecastRoutes);
  await app.register(gateRoutes);
  await app.register(cvRoutes);
  await app.register(sensorRoutes);
  await app.register(reportsRoutes({ config }));
  await app.register(insightsRoutes);
  await app.register(auditRoutes);

  await app.register(staticWebPlugin, {});

  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  return app;
}
