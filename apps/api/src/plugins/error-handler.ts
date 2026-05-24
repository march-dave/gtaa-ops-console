import fp from "fastify-plugin";
import type { FastifyError, FastifyPluginAsync } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";

const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const traceId = req.id;

    if (hasZodFastifySchemaValidationErrors(err)) {
      req.log.warn({ err, traceId }, "schema validation failed");
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Request did not match the expected schema",
        traceId,
        details: { issues: err.validation },
      });
    }

    if (err instanceof ZodError) {
      req.log.warn({ err, traceId }, "zod validation failed");
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: err.message,
        traceId,
        details: { issues: err.issues },
      });
    }

    const status = err.statusCode ?? 500;
    if (status < 500) {
      req.log.info({ err, traceId }, "client error");
      return reply.status(status).send({
        code: err.code ?? "CLIENT_ERROR",
        message: err.message,
        traceId,
      });
    }

    req.log.error({ err, traceId }, "unhandled server error");
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      traceId,
    });
  });
};

export default fp(errorHandler, { name: "error-handler" });
