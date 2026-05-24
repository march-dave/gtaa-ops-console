import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import type {
  AuditAction,
  AuditEvent,
  AuditQuery,
  AuditResourceType,
  Role,
} from "@gtaa/contracts";

export interface RecordAuditInput {
  actorId: string;
  actorDisplayName: string;
  actorRole: Role;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  traceId?: string | null;
}

export interface AuditStore {
  record: (input: RecordAuditInput) => AuditEvent;
  list: (query: AuditQuery) => { items: AuditEvent[]; nextCursor: string | null };
}

declare module "fastify" {
  interface FastifyInstance {
    audit: AuditStore;
  }
}

/** In-memory append-only audit log. Swap for a DB-backed implementation later. */
const createAuditStore = (): AuditStore => {
  const events: AuditEvent[] = [];

  return {
    record(input) {
      const event: AuditEvent = {
        id: randomUUID(),
        actorId: input.actorId,
        actorDisplayName: input.actorDisplayName,
        actorRole: input.actorRole,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        before: input.before ?? null,
        after: input.after ?? null,
        reason: input.reason ?? null,
        traceId: input.traceId ?? null,
        createdAt: new Date().toISOString(),
      };
      events.push(event);
      return event;
    },
    list(query) {
      let filtered = events;
      if (query.resourceType) {
        filtered = filtered.filter((e) => e.resourceType === query.resourceType);
      }
      if (query.resourceId) {
        filtered = filtered.filter((e) => e.resourceId === query.resourceId);
      }
      if (query.actorId) {
        filtered = filtered.filter((e) => e.actorId === query.actorId);
      }
      if (query.action) {
        filtered = filtered.filter((e) => e.action === query.action);
      }
      if (query.since) {
        filtered = filtered.filter((e) => e.createdAt >= query.since!);
      }
      if (query.until) {
        filtered = filtered.filter((e) => e.createdAt <= query.until!);
      }
      const ordered = [...filtered].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      const items = ordered.slice(0, query.limit);
      const nextCursor =
        ordered.length > query.limit ? ordered[query.limit]!.createdAt : null;
      return { items, nextCursor };
    },
  };
};

const auditPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("audit", createAuditStore());
};

export default fp(auditPlugin, { name: "audit" });
