import type { OpsStore } from "../lib/store.js";
import {
  buildRecommendation,
  seedFlightsAndGates,
} from "./gate-recommendation-service.js";

export function buildSeedData() {
  return seedFlightsAndGates();
}

/** Generates initial recommendations from seeded flights against seeded gates. */
export function generateInitialRecommendations(store: OpsStore): void {
  const gates = store.listGates();
  const occupied = new Set(
    gates.filter((g) => g.currentFlightId).map((g) => g.id)
  );
  for (const flight of store.listFlights()) {
    const rec = buildRecommendation({ flight, gates, occupiedGateIds: occupied });
    if (rec) store.upsertRecommendation(rec);
  }
}
