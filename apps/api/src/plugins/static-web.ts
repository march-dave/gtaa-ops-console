import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

interface StaticWebOptions {
  /** Absolute or relative path to the directory containing index.html. */
  root?: string;
}

const staticWebPlugin: FastifyPluginAsync<StaticWebOptions> = async (
  app,
  { root }
) => {
  const candidates = [
    root,
    process.env.WEB_DIST_DIR,
    "./public",
    "./web",
    resolve(dirname(fileURLToPath(import.meta.url)), "../public"),
  ].filter((p): p is string => Boolean(p));

  const dir = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
  if (!dir) {
    app.log.info(
      { tried: candidates },
      "static web root not found — API will not serve SPA"
    );
    return;
  }

  const fastifyStatic = (await import("@fastify/static")).default;

  await app.register(fastifyStatic, {
    root: dir,
    prefix: "/",
    wildcard: false,
  });

  // SPA fallback: anything that isn't an API/docs/health route returns index.html.
  app.setNotFoundHandler((req, reply) => {
    if (
      req.url.startsWith("/api") ||
      req.url.startsWith("/docs") ||
      req.url === "/health" ||
      req.url === "/ready"
    ) {
      reply.code(404).send({
        code: "NOT_FOUND",
        message: `Route ${req.method}:${req.url} not found`,
      });
      return;
    }
    reply.type("text/html").sendFile("index.html");
  });

  app.log.info({ dir }, "serving SPA from static root");
};

export default fp(staticWebPlugin, { name: "static-web" });
