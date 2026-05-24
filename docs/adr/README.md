# Architecture Decision Records

We capture decisions that are expensive to change later (data shapes, auth
patterns, hosting choices) here so a future engineer can reconstruct *why* —
not just *what*.

- [0001 — Monorepo with shared contracts](0001-monorepo-with-shared-contracts.md)
- [0002 — Fastify over Express](0002-fastify-over-express.md)
- [0003 — Audit log as immutable append-only events](0003-audit-log-immutable-pattern.md)
- [0004 — Entra ID app roles, not group claims](0004-entra-id-app-roles-not-groups.md)
- [0005 — Real-time updates: Server-Sent Events](0005-realtime-updates-sse.md)
- [0006 — Power BI embed via service principal](0006-power-bi-embed-via-service-principal.md)
- 0007 — Azure hosting: App Service vs Container Apps vs Functions *(planned, Day 5)*
- [0008 — Microsoft Fabric Lakehouse for operational analytics](0008-fabric-lakehouse-integration.md)

## Format

Each ADR is one short page:

```
# ADR NNNN — Title
- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context           ← the forces in play
## Decision          ← what we picked, stated as a present-tense fact
## Consequences      ← + and −, including what this makes harder
## (optional) Alternatives considered
```
