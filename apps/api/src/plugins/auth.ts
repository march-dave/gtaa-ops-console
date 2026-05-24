import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { Role, hasRoleAtLeast, type User } from "@gtaa/contracts";

import type { Config } from "../config.js";

declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => User;
    requireRole: (
      req: FastifyRequest,
      role: ReturnType<typeof Role.parse>
    ) => User;
  }
}

const MOCK_USERS: Record<string, User> = {
  viewer: {
    id: "mock-viewer",
    oid: "00000000-0000-0000-0000-000000000001",
    email: "viewer@gtaa.example",
    displayName: "Vera Viewer",
    roles: ["Viewer"],
  },
  duty: {
    id: "mock-duty",
    oid: "00000000-0000-0000-0000-000000000002",
    email: "duty@gtaa.example",
    displayName: "Dana Duty-Manager",
    roles: ["DutyManager"],
  },
  ops: {
    id: "mock-ops",
    oid: "00000000-0000-0000-0000-000000000003",
    email: "ops@gtaa.example",
    displayName: "Omar Ops-Manager",
    roles: ["OpsManager"],
  },
};

export interface AuthPluginOptions {
  config: Config;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (
  app,
  { config }
) => {
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (req) => {
    if (config.AUTH_MODE === "mock") {
      const header = req.headers["x-mock-user"];
      const headerKey = Array.isArray(header) ? header[0] : header;
      // EventSource cannot set custom headers; SSE endpoints accept ?mockUser=.
      const query = req.query as Record<string, unknown> | undefined;
      const queryKey =
        typeof query?.mockUser === "string" ? query.mockUser : undefined;
      const key = headerKey ?? queryKey;
      if (key && MOCK_USERS[key]) {
        req.user = MOCK_USERS[key];
      }
      return;
    }
    // AUTH_MODE === "entra": real token validation goes here
    // For now we leave req.user null; routes requiring auth will 401
    // TODO: validate bearer token against ENTRA_TENANT_ID + ENTRA_AUDIENCE
  });

  app.decorate("requireAuth", (req: FastifyRequest): User => {
    if (!req.user) {
      throw app.httpErrors.unauthorized("Authentication required");
    }
    return req.user;
  });

  app.decorate(
    "requireRole",
    (req: FastifyRequest, role: ReturnType<typeof Role.parse>): User => {
      const user = app.requireAuth(req);
      if (!hasRoleAtLeast(user.roles, role)) {
        throw app.httpErrors.forbidden(`Requires role ${role} or higher`);
      }
      return user;
    }
  );
};

export default fp(authPlugin, { name: "auth" });
