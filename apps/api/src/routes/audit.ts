import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ApiError, AuditEvent, AuditQuery } from "@gtaa/contracts";

const AuditPage = z.object({
  items: z.array(AuditEvent),
  nextCursor: z.string().nullable(),
});

const auditRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/audit",
    {
      schema: {
        tags: ["audit"],
        description:
          "List recent audit events. Append-only — never includes mutated records.",
        querystring: AuditQuery,
        response: { 200: AuditPage, 401: ApiError },
      },
    },
    async (req) => {
      app.requireAuth(req);
      return app.audit.list(req.query);
    }
  );
};

export default auditRoutes;
