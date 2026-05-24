import { z } from "zod";
import { IsoDateTime, Role } from "./common.js";

export const AuditAction = z.enum([
  "recommendation.approved",
  "recommendation.rejected",
  "recommendation.overridden",
  "cv_event.acknowledged",
  "cv_event.escalated",
  "cv_event.resolved",
  "sensor.alert_silenced",
  "user.signed_in",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const AuditResourceType = z.enum([
  "gate_recommendation",
  "cv_event",
  "sensor",
  "session",
]);
export type AuditResourceType = z.infer<typeof AuditResourceType>;

export const AuditEvent = z.object({
  id: z.string(),
  actorId: z.string(),
  actorDisplayName: z.string(),
  actorRole: Role,
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().nullable(),
  traceId: z.string().nullable(),
  createdAt: IsoDateTime,
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const AuditQuery = z.object({
  resourceType: AuditResourceType.optional(),
  resourceId: z.string().optional(),
  actorId: z.string().optional(),
  action: AuditAction.optional(),
  since: IsoDateTime.optional(),
  until: IsoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type AuditQuery = z.infer<typeof AuditQuery>;
