import { randomUUID } from "node:crypto";
import {
  AIRCRAFT_SIZE_RANK,
  type AircraftSize,
  type ConstraintCheck,
  type Flight,
  type Gate,
  type GateRecommendation,
} from "@gtaa/contracts";

const MODEL_VERSION = "gate-allocator-v0.5.0-synth";

interface RecommendInput {
  flight: Flight;
  gates: Gate[];
  occupiedGateIds: ReadonlySet<string>;
}

/**
 * Pick the best compatible gate for a flight.
 * Constraints: aircraft-size compatibility, gate availability, terminal preference.
 * Returns null if no compatible gate exists.
 */
export function buildRecommendation({
  flight,
  gates,
  occupiedGateIds,
}: RecommendInput): GateRecommendation | null {
  const needed = AIRCRAFT_SIZE_RANK[flight.aircraftSize];
  const compatible = gates.filter(
    (g) => AIRCRAFT_SIZE_RANK[g.maxAircraftSize] >= needed
  );
  if (compatible.length === 0) return null;

  const candidates = compatible.map((gate) => {
    const sizeGap = AIRCRAFT_SIZE_RANK[gate.maxAircraftSize] - needed;
    const occupied = occupiedGateIds.has(gate.id);
    const sizeFit = sizeGap === 0 ? 1 : sizeGap === 1 ? 0.85 : 0.65;
    const availability = occupied ? 0.2 : 1;
    const score = sizeFit * availability;
    return { gate, score, sizeGap, occupied };
  });

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0]!;

  const constraints: ConstraintCheck[] = [
    {
      name: "aircraft_size_compatible",
      satisfied: top.sizeGap >= 0,
      detail:
        top.sizeGap === 0
          ? "exact size match"
          : `gate accommodates +${top.sizeGap} size class(es)`,
    },
    {
      name: "gate_available",
      satisfied: !top.occupied,
      detail: top.occupied ? "currently occupied" : "free",
    },
    {
      name: "terminal_assigned",
      satisfied: true,
      detail: `${top.gate.terminal} ${top.gate.code}`,
    },
  ];

  const rationale = describeChoice(flight, top.gate, top.sizeGap, top.occupied);
  const confidence = clamp01(top.score);

  return {
    id: randomUUID(),
    flightId: flight.id,
    suggestedGateId: top.gate.id,
    confidence,
    modelVersion: MODEL_VERSION,
    rationale,
    constraints,
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    overrideGateId: null,
    decisionReason: null,
  };
}

function describeChoice(
  flight: Flight,
  gate: Gate,
  sizeGap: number,
  occupied: boolean
): string {
  const sizeNote =
    sizeGap === 0
      ? "exact aircraft-size match"
      : `gate handles +${sizeGap} class above ${flight.aircraftSize}`;
  const availNote = occupied
    ? "gate is currently occupied — recommend on next turn"
    : "gate is available";
  return `${gate.terminal} ${gate.code}: ${sizeNote}; ${availNote}.`;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n.toFixed(2))));

export function applyDecisionEffects(
  rec: GateRecommendation,
  decidedBy: string,
  decision:
    | { action: "approve" }
    | { action: "reject"; reason: string }
    | { action: "override"; overrideGateId: string; reason: string }
): GateRecommendation {
  const now = new Date().toISOString();
  const base: GateRecommendation = {
    ...rec,
    decidedAt: now,
    decidedBy,
  };
  switch (decision.action) {
    case "approve":
      return { ...base, status: "approved" };
    case "reject":
      return { ...base, status: "rejected", decisionReason: decision.reason };
    case "override":
      return {
        ...base,
        status: "overridden",
        overrideGateId: decision.overrideGateId,
        decisionReason: decision.reason,
      };
  }
}

export function seedFlightsAndGates(): { flights: Flight[]; gates: Gate[] } {
  const gates: Gate[] = [
    g("g-t1-d22", "T1", "D22", "L"),
    g("g-t1-d24", "T1", "D24", "M"),
    g("g-t1-d26", "T1", "D26", "S"),
    g("g-t1-d28", "T1", "D28", "L"),
    g("g-t1-d31", "T1", "D31", "XL"),
    g("g-t3-b32", "T3", "B32", "M"),
    g("g-t3-b35", "T3", "B35", "L"),
    g("g-t3-b37", "T3", "B37", "L"),
    g("g-t3-b40", "T3", "B40", "XL"),
    g("g-t3-b42", "T3", "B42", "XL"),
  ];

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

  const flights: Flight[] = [
    f("f-ac811", "AC811", "Air Canada", inHours(1), "L", "YYZ", "LHR"),
    f("f-wj012", "WS012", "WestJet", inHours(2), "M", "YYZ", "YVR"),
    f("f-uavolare", "VA240", "Volare", inHours(2), "S", "YYZ", "YOW"),
    f("f-ac155", "AC155", "Air Canada", inHours(3), "XL", "YYZ", "HND"),
    f("f-lh471", "LH471", "Lufthansa", inHours(3), "L", "YYZ", "FRA"),
    f("f-emt2", "EM2", "Empire Air", inHours(4), "M", "YYZ", "JFK"),
    f("f-qf008", "QF008", "Qantas", inHours(5), "XL", "YYZ", "SYD"),
    f("f-ac404", "AC404", "Air Canada", inHours(6), "S", "YYZ", "YHZ"),
  ];

  return { flights, gates };
}

function g(id: string, terminal: "T1" | "T3", code: string, maxSize: AircraftSize): Gate {
  return { id, terminal, code, maxAircraftSize: maxSize, currentFlightId: null };
}

function f(
  id: string,
  flightNo: string,
  airline: string,
  scheduledTime: string,
  aircraftSize: AircraftSize,
  origin: string,
  destination: string
): Flight {
  return {
    id,
    flightNo,
    airline,
    scheduledTime,
    aircraftSize,
    origin,
    destination,
    status: "scheduled",
  };
}
