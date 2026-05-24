import { z } from "zod";
import { IsoDateTime } from "./common.js";

export const CvEventType = z.enum([
  "aircraft_arrival",
  "aircraft_departure",
  "gse_proximity",
  "safety_zone_breach",
  "fod_detected",
  "person_in_restricted_area",
]);
export type CvEventType = z.infer<typeof CvEventType>;

export const CvSeverity = z.enum(["info", "warn", "critical"]);
export type CvSeverity = z.infer<typeof CvSeverity>;

export const CvEventStatus = z.enum(["new", "acknowledged", "escalated", "resolved"]);
export type CvEventStatus = z.infer<typeof CvEventStatus>;

export const BoundingBox = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const CvEvent = z.object({
  id: z.string(),
  cameraId: z.string(),
  standCode: z.string().describe("Aircraft stand or gate code where this was detected"),
  eventType: CvEventType,
  severity: CvSeverity,
  detectedAt: IsoDateTime,
  status: CvEventStatus,
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: IsoDateTime.nullable(),
  payload: z.object({
    confidence: z.number().min(0).max(1),
    snapshotUrl: z.string().url().nullable(),
    boundingBox: BoundingBox.nullable(),
    notes: z.string().nullable(),
  }),
});
export type CvEvent = z.infer<typeof CvEvent>;

export const CvActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }),
  z.object({ action: z.literal("escalate"), reason: z.string().min(1).max(500) }),
  z.object({ action: z.literal("resolve"), notes: z.string().max(500).optional() }),
]);
export type CvActionInput = z.infer<typeof CvActionInput>;

export const CvStreamEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), events: z.array(CvEvent) }),
  z.object({ type: z.literal("created"), event: CvEvent }),
  z.object({ type: z.literal("updated"), event: CvEvent }),
  z.object({ type: z.literal("heartbeat"), at: IsoDateTime }),
]);
export type CvStreamEvent = z.infer<typeof CvStreamEvent>;

export const CvListQuery = z.object({
  status: CvEventStatus.optional(),
  severity: CvSeverity.optional(),
  since: IsoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type CvListQuery = z.infer<typeof CvListQuery>;
