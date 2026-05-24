import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

import { createOpsStore, type OpsStore } from "../lib/store.js";
import {
  buildSeedData,
  generateInitialRecommendations,
} from "../services/seed.js";

declare module "fastify" {
  interface FastifyInstance {
    store: OpsStore;
  }
}

const storePlugin: FastifyPluginAsync = async (app) => {
  const seed = buildSeedData();
  const store = createOpsStore(seed);
  generateInitialRecommendations(store);
  app.decorate("store", store);
  app.log.info(
    {
      flights: seed.flights.length,
      gates: seed.gates.length,
      recommendations: store.listRecommendations().length,
    },
    "ops store seeded"
  );
};

export default fp(storePlugin, { name: "store" });
