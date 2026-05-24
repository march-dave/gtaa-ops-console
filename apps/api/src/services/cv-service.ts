import { randomUUID } from "node:crypto";
import type {
  CvActionInput,
  CvEvent,
  CvEventType,
  CvSeverity,
} from "@gtaa/contracts";

interface EventBlueprint {
  eventType: CvEventType;
  severity: CvSeverity;
  cameras: string[];
  standCodes: string[];
  baseConfidence: number;
}

const BLUEPRINTS: EventBlueprint[] = [
  {
    eventType: "aircraft_arrival",
    severity: "info",
    cameras: ["CAM-T3-A1", "CAM-T3-A3", "CAM-T1-D2"],
    standCodes: ["B32", "B35", "B40", "D22", "D26"],
    baseConfidence: 0.92,
  },
  {
    eventType: "aircraft_departure",
    severity: "info",
    cameras: ["CAM-T3-A2", "CAM-T1-D1"],
    standCodes: ["B37", "B40", "D24", "D31"],
    baseConfidence: 0.91,
  },
  {
    eventType: "gse_proximity",
    severity: "warn",
    cameras: ["CAM-T3-B5", "CAM-T1-D2"],
    standCodes: ["B32", "B35", "B42", "D28", "D31"],
    baseConfidence: 0.81,
  },
  {
    eventType: "safety_zone_breach",
    severity: "critical",
    cameras: ["CAM-T3-B7", "CAM-T1-D3"],
    standCodes: ["B40", "B42", "D31"],
    baseConfidence: 0.88,
  },
  {
    eventType: "fod_detected",
    severity: "warn",
    cameras: ["CAM-RWY-06L", "CAM-RWY-24R"],
    standCodes: ["RWY-06L", "RWY-24R"],
    baseConfidence: 0.76,
  },
  {
    eventType: "person_in_restricted_area",
    severity: "critical",
    cameras: ["CAM-T3-PERI", "CAM-T1-PERI"],
    standCodes: ["PERI-3A", "PERI-1B"],
    baseConfidence: 0.83,
  },
];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

export function createSyntheticCvEvent(now: Date = new Date()): CvEvent {
  const bp = pick(BLUEPRINTS);
  const jitter = (Math.random() - 0.5) * 0.12;
  const confidence = Math.max(0.5, Math.min(0.99, bp.baseConfidence + jitter));
  return {
    id: randomUUID(),
    cameraId: pick(bp.cameras),
    standCode: pick(bp.standCodes),
    eventType: bp.eventType,
    severity: bp.severity,
    detectedAt: now.toISOString(),
    status: "new",
    acknowledgedBy: null,
    acknowledgedAt: null,
    payload: {
      confidence: Number(confidence.toFixed(2)),
      snapshotUrl: null,
      boundingBox: null,
      notes: null,
    },
  };
}

export function applyCvAction(
  event: CvEvent,
  actorId: string,
  action: CvActionInput
): CvEvent {
  const now = new Date().toISOString();
  switch (action.action) {
    case "acknowledge":
      return {
        ...event,
        status: "acknowledged",
        acknowledgedBy: actorId,
        acknowledgedAt: now,
      };
    case "escalate":
      return {
        ...event,
        status: "escalated",
        payload: {
          ...event.payload,
          notes:
            event.payload.notes !== null
              ? `${event.payload.notes}\nEscalation: ${action.reason}`
              : `Escalation: ${action.reason}`,
        },
      };
    case "resolve":
      return {
        ...event,
        status: "resolved",
        payload: {
          ...event.payload,
          notes:
            action.notes !== undefined
              ? action.notes
              : event.payload.notes,
        },
      };
  }
}
