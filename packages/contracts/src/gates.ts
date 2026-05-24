import { z } from "zod";
import { IsoDateTime } from "./common.js";
import { Terminal } from "./forecast.js";

export const AircraftSize = z.enum(["S", "M", "L", "XL"]);
export type AircraftSize = z.infer<typeof AircraftSize>;

export const AIRCRAFT_SIZE_RANK: Record<AircraftSize, number> = {
  S: 0,
  M: 1,
  L: 2,
  XL: 3,
};

export const FlightStatus = z.enum([
  "scheduled",
  "boarding",
  "departed",
  "arrived",
  "delayed",
  "cancelled",
]);
export type FlightStatus = z.infer<typeof FlightStatus>;

export const Flight = z.object({
  id: z.string(),
  flightNo: z.string(),
  airline: z.string(),
  scheduledTime: IsoDateTime,
  aircraftSize: AircraftSize,
  origin: z.string(),
  destination: z.string(),
  status: FlightStatus,
});
export type Flight = z.infer<typeof Flight>;

export const Gate = z.object({
  id: z.string(),
  terminal: Terminal,
  code: z.string(),
  maxAircraftSize: AircraftSize,
  currentFlightId: z.string().nullable(),
});
export type Gate = z.infer<typeof Gate>;

export const RecommendationStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "overridden",
  "expired",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatus>;

export const ConstraintCheck = z.object({
  name: z.string(),
  satisfied: z.boolean(),
  detail: z.string().optional(),
});
export type ConstraintCheck = z.infer<typeof ConstraintCheck>;

export const GateRecommendation = z.object({
  id: z.string(),
  flightId: z.string(),
  suggestedGateId: z.string(),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string(),
  rationale: z.string(),
  constraints: z.array(ConstraintCheck),
  status: RecommendationStatus,
  createdAt: IsoDateTime,
  decidedAt: IsoDateTime.nullable(),
  decidedBy: z.string().nullable(),
  overrideGateId: z.string().nullable(),
  decisionReason: z.string().nullable(),
});
export type GateRecommendation = z.infer<typeof GateRecommendation>;

export const ApprovalActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1).max(500) }),
  z.object({
    action: z.literal("override"),
    overrideGateId: z.string().min(1),
    reason: z.string().min(1).max(500),
  }),
]);
export type ApprovalActionInput = z.infer<typeof ApprovalActionInput>;

export const RecommendationListQuery = z.object({
  status: RecommendationStatus.optional(),
  terminal: Terminal.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type RecommendationListQuery = z.infer<typeof RecommendationListQuery>;
