# ADR 0001 — Monorepo with shared contracts package

- **Status**: Accepted
- **Date**: 2026-05-23

## Context

The console couples a React frontend, a Node API, and (later) Azure-Function
data adapters. Each consumes the same data shapes — forecasts, gate
recommendations, audit events, CV events. Without a shared definition, the
shapes drift, the FE/BE contract breaks at runtime, and "productionizing the
prototype" turns into a hunt for stale field names.

## Decision

Use a pnpm workspace with three layers:

- `packages/contracts` — Zod schemas + inferred TypeScript types + OpenAPI
  generator. No runtime dependencies on FE or BE frameworks. **Source of truth.**
- `apps/api` — imports schemas, uses them at the Fastify route boundary.
- `apps/web` — imports schemas, validates at the network boundary and infers
  React Query result types.

Contracts is consumed as TypeScript source (`"main": "./src/index.ts"`). No
intermediate build step; both apps pick it up directly via pnpm's workspace
linking. The OpenAPI spec is generated on demand
(`pnpm contracts:openapi`) for external consumers (Power BI / Fabric, ML
notebooks).

## Consequences

- **+** A breaking schema change fails to compile in *both* apps simultaneously
  — impossible to deploy a half-migrated system.
- **+** The OpenAPI spec is never out of sync with the implementation because
  both flow from the same Zod schema.
- **+** Onboarding: a new contributor learns the API surface by reading one
  package.
- **−** Touching contracts triggers typecheck for every consumer, which is
  slower than independent repos.
- **−** Versioning is implicit (everyone is on the latest). For an internal
  enterprise app this is desirable; for a public API we'd publish contracts
  as a versioned npm package.
