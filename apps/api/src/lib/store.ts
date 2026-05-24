import type { Flight, Gate, GateRecommendation } from "@gtaa/contracts";

/**
 * In-memory data layer. Single source of truth at runtime.
 * Swap with a DB-backed implementation later; the interface stays the same.
 */
export interface OpsStore {
  listFlights: () => Flight[];
  getFlight: (id: string) => Flight | null;

  listGates: () => Gate[];
  getGate: (id: string) => Gate | null;
  setGateCurrentFlight: (gateId: string, flightId: string | null) => void;

  listRecommendations: (filter?: {
    status?: GateRecommendation["status"];
    terminal?: Gate["terminal"];
  }) => GateRecommendation[];
  getRecommendation: (id: string) => GateRecommendation | null;
  upsertRecommendation: (rec: GateRecommendation) => void;
}

export interface CreateOpsStoreInput {
  flights: Flight[];
  gates: Gate[];
}

export function createOpsStore(seed: CreateOpsStoreInput): OpsStore {
  const flights = new Map<string, Flight>(seed.flights.map((f) => [f.id, f]));
  const gates = new Map<string, Gate>(seed.gates.map((g) => [g.id, g]));
  const recs = new Map<string, GateRecommendation>();

  return {
    listFlights: () =>
      [...flights.values()].sort((a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime)
      ),
    getFlight: (id) => flights.get(id) ?? null,

    listGates: () =>
      [...gates.values()].sort((a, b) => a.code.localeCompare(b.code)),
    getGate: (id) => gates.get(id) ?? null,
    setGateCurrentFlight: (gateId, flightId) => {
      const gate = gates.get(gateId);
      if (gate) gates.set(gateId, { ...gate, currentFlightId: flightId });
    },

    listRecommendations: (filter) => {
      let items = [...recs.values()];
      if (filter?.status) {
        items = items.filter((r) => r.status === filter.status);
      }
      if (filter?.terminal) {
        items = items.filter((r) => {
          const gate = gates.get(r.suggestedGateId);
          return gate?.terminal === filter.terminal;
        });
      }
      return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    getRecommendation: (id) => recs.get(id) ?? null,
    upsertRecommendation: (rec) => {
      recs.set(rec.id, rec);
    },
  };
}
