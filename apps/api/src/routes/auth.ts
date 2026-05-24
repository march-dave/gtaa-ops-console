import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { User, ApiError } from "@gtaa/contracts";

const authRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/auth/me",
    {
      schema: {
        tags: ["auth"],
        description:
          "Return the current authenticated user. In mock mode, sends header X-Mock-User: viewer|duty|ops.",
        response: { 200: User, 401: ApiError },
      },
    },
    async (req) => app.requireAuth(req)
  );
};

export default authRoutes;
