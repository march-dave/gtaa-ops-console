import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { CvEvent, CvEventStatus, CvStreamEvent } from "@gtaa/contracts";

import { createSyntheticCvEvent } from "../services/cv-service.js";

export interface CvStore {
  list: (filter?: { status?: CvEventStatus; limit?: number }) => CvEvent[];
  get: (id: string) => CvEvent | null;
  upsert: (event: CvEvent) => void;
  /** Subscribe to incremental changes; returns an unsubscribe function. */
  subscribe: (listener: (msg: CvStreamEvent) => void) => () => void;
  /** Force-create a synthetic event (used in tests). */
  generateNow: () => CvEvent;
  /** Snapshot the most recent events for an initial SSE message. */
  snapshot: (limit?: number) => CvEvent[];
  /** Stop the ticker (test cleanup). */
  stop: () => void;
}

interface CvPluginOptions {
  tickIntervalMs?: number;
  initialBacklog?: number;
  maxEvents?: number;
  enableTicker?: boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    cv: CvStore;
  }
}

const MAX_EVENTS_DEFAULT = 200;
const TICK_DEFAULT = 9_000;
const INITIAL_DEFAULT = 6;

const cvStreamPlugin: FastifyPluginAsync<CvPluginOptions> = async (app, opts) => {
  const events: CvEvent[] = [];
  const listeners = new Set<(msg: CvStreamEvent) => void>();
  const max = opts.maxEvents ?? MAX_EVENTS_DEFAULT;
  const tickInterval = opts.tickIntervalMs ?? TICK_DEFAULT;
  const enableTicker =
    opts.enableTicker ?? process.env.NODE_ENV !== "test";

  const broadcast = (msg: CvStreamEvent): void => {
    for (const l of listeners) {
      try {
        l(msg);
      } catch (err) {
        app.log.warn({ err }, "cv stream listener failed");
      }
    }
  };

  const pushEvent = (event: CvEvent, kind: "created" | "updated"): void => {
    if (kind === "created") {
      events.push(event);
      if (events.length > max) events.splice(0, events.length - max);
    } else {
      const idx = events.findIndex((e) => e.id === event.id);
      if (idx >= 0) events[idx] = event;
    }
    broadcast({ type: kind, event });
  };

  // Backfill so the UI has something on first load.
  const backlogStart = Date.now() - 30 * 60_000;
  for (let i = 0; i < (opts.initialBacklog ?? INITIAL_DEFAULT); i += 1) {
    const ts = new Date(backlogStart + (i + 1) * (30 * 60_000 / INITIAL_DEFAULT));
    const evt = createSyntheticCvEvent(ts);
    events.push(evt);
  }

  let timer: NodeJS.Timeout | null = null;
  if (enableTicker) {
    timer = setInterval(() => {
      const evt = createSyntheticCvEvent();
      pushEvent(evt, "created");
    }, tickInterval);
    timer.unref?.();
  }

  const heartbeat = setInterval(() => {
    broadcast({ type: "heartbeat", at: new Date().toISOString() });
  }, 15_000);
  heartbeat.unref?.();

  const store: CvStore = {
    list({ status, limit } = {}) {
      let items = [...events];
      if (status) items = items.filter((e) => e.status === status);
      items.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
      if (limit) items = items.slice(0, limit);
      return items;
    },
    get: (id) => events.find((e) => e.id === id) ?? null,
    upsert(event) {
      const exists = events.some((e) => e.id === event.id);
      pushEvent(event, exists ? "updated" : "created");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    generateNow() {
      const evt = createSyntheticCvEvent();
      pushEvent(evt, "created");
      return evt;
    },
    snapshot(limit = 30) {
      return [...events]
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
        .slice(0, limit);
    },
    stop() {
      if (timer) clearInterval(timer);
      clearInterval(heartbeat);
      listeners.clear();
    },
  };

  app.decorate("cv", store);
  app.addHook("onClose", async () => {
    store.stop();
  });
};

export default fp(cvStreamPlugin, { name: "cv-stream" });
