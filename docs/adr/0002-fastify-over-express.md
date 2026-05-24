# ADR 0002 — Fastify over Express

- **Status**: Accepted
- **Date**: 2026-05-23

## Context

The API needs typed request/response schemas, OpenAPI emission, structured
logging, and a clean plugin model for cross-cutting concerns (auth, audit,
error mapping). Two realistic choices for a Node/TS backend: Express (most
familiar) and Fastify (more opinionated, schema-first).

## Decision

Use Fastify 5 + `fastify-type-provider-zod`.

The route `schema` field accepts Zod schemas directly, which means:

- Validation, response serialization, and OpenAPI emission all derive from
  the same schema instance.
- `request.query`, `request.body`, etc. are typed at the handler — no manual
  type assertions, no `as` casts at the boundary.
- The `@fastify/swagger` plugin reads the same schema set and serves Swagger
  UI at `/docs` without a separate spec file.

Pino is built in for structured logging; the per-request `traceId` is the
Fastify request id — no extra middleware.

## Consequences

- **+** One schema definition powers four things (runtime validation, TS
  types, OpenAPI, audit "before/after" snapshots).
- **+** Pino + request id is enough observability for App Insights — no
  bespoke logging glue.
- **+** Plugin system maps cleanly to cross-cutting concerns: `authPlugin`,
  `auditPlugin`, `errorHandlerPlugin` each encapsulate one concern.
- **−** Smaller ecosystem than Express — some middleware doesn't have a
  Fastify equivalent and needs a thin wrapper.
- **−** Slightly steeper learning curve for engineers fluent in Express.

## Alternatives considered

- **Express + Zod + manual OpenAPI**: more code to maintain, three-way drift
  risk between validators, types, and the spec.
- **NestJS**: powerful but introduces decorators, DI, and module boilerplate
  that this project doesn't need. Worth revisiting if the team grows past
  ~4 engineers and the domain grows beyond what plugins can model.
