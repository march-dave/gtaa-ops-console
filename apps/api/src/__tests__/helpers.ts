import type { FastifyInstance } from "fastify";

import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

export async function buildTestApp(): Promise<FastifyInstance> {
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  const config = loadConfig({ ...process.env, NODE_ENV: "test", LOG_LEVEL: "silent" });
  return buildApp({ config });
}

export const asDuty = { "x-mock-user": "duty" };
export const asViewer = { "x-mock-user": "viewer" };
export const asOps = { "x-mock-user": "ops" };
