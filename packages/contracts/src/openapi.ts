import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import { z } from "zod";

extendZodWithOpenApi(z);

import { ApiError, Role } from "./common.js";
import { User, Session } from "./auth.js";
import {
  ForecastPoint,
  ForecastRecommendation,
  PassengerFlowForecast,
  Terminal,
} from "./forecast.js";
import {
  AircraftSize,
  ApprovalActionInput,
  ConstraintCheck,
  Flight,
  FlightStatus,
  Gate,
  GateRecommendation,
  RecommendationStatus,
} from "./gates.js";
import { AuditAction, AuditEvent, AuditResourceType } from "./audit.js";
import {
  CvActionInput,
  CvEvent,
  CvEventStatus,
  CvEventType,
  CvSeverity,
  CvStreamEvent,
} from "./cv.js";
import {
  Sensor,
  SensorReading,
  SensorStatus,
  SensorStatusKind,
  SensorType,
} from "./sensors.js";
import { EmbedToken, EmbedTokenRequest } from "./reports.js";

export function createRegistry(): OpenAPIRegistry {
  const r = new OpenAPIRegistry();

  r.register("Role", Role);
  r.register("ApiError", ApiError);

  r.register("User", User);
  r.register("Session", Session);

  r.register("Terminal", Terminal);
  r.register("ForecastPoint", ForecastPoint);
  r.register("ForecastRecommendation", ForecastRecommendation);
  r.register("PassengerFlowForecast", PassengerFlowForecast);

  r.register("AircraftSize", AircraftSize);
  r.register("FlightStatus", FlightStatus);
  r.register("Flight", Flight);
  r.register("Gate", Gate);
  r.register("ConstraintCheck", ConstraintCheck);
  r.register("RecommendationStatus", RecommendationStatus);
  r.register("GateRecommendation", GateRecommendation);
  r.register("ApprovalActionInput", ApprovalActionInput);

  r.register("AuditAction", AuditAction);
  r.register("AuditResourceType", AuditResourceType);
  r.register("AuditEvent", AuditEvent);

  r.register("CvEventType", CvEventType);
  r.register("CvSeverity", CvSeverity);
  r.register("CvEventStatus", CvEventStatus);
  r.register("CvEvent", CvEvent);
  r.register("CvStreamEvent", CvStreamEvent);
  r.register("CvActionInput", CvActionInput);

  r.register("SensorType", SensorType);
  r.register("SensorStatusKind", SensorStatusKind);
  r.register("Sensor", Sensor);
  r.register("SensorReading", SensorReading);
  r.register("SensorStatus", SensorStatus);

  r.register("EmbedTokenRequest", EmbedTokenRequest);
  r.register("EmbedToken", EmbedToken);

  return r;
}

export function buildOpenApiDocument(registry: OpenAPIRegistry): OpenAPIObject {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "GTAA Ops Console API",
      version: "0.1.0",
      description:
        "Decision-support console for airport operations. Forecasts, gate-allocation recommendations, CV alerts, sensor analytics, audit.",
    },
    servers: [
      { url: "http://localhost:8080", description: "Local dev" },
      { url: "https://api.gtaa-ops.example", description: "Azure App Service" },
    ],
  });
}
