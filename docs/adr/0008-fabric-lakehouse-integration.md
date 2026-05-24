# ADR 0008 — Microsoft Fabric Lakehouse for operational analytics

- **Status**: Accepted (implementation: pattern only; live query requires a Fabric capacity)
- **Date**: 2026-05-23

## Context

The operational console handles **live transactional data** (forecasts,
recommendations, CV events, sensor readings) — small, hot, latency-sensitive.
It also needs to answer **analytical questions** (forecast accuracy over time,
override rate by gate, sensor anomaly leaderboard) — historical, cool,
aggregate.

Trying to serve both shapes from the same store leads to either:
- expensive scans against the transactional DB (slow + competes with operators), or
- duplicated denormalized rollups maintained by hand (drift + bugs).

The GTAA stack already includes Microsoft Fabric for data engineering work,
so the Lakehouse is the natural read-side source of truth for analytics.

## Decision

Operational state lives in a transactional store (Azure SQL / Cosmos in
production, in-memory for the demo). It is **mirrored asynchronously** into a
**Microsoft Fabric Lakehouse** (`ops_lakehouse@gtaaops.fabric`) — either via
Fabric Mirroring, an Eventstream, or a Data Factory pipeline depending on
volume.

The console reads analytics from the Lakehouse's **T-SQL endpoint** over
Delta tables:

```
Server=tcp:gtaaops.datawarehouse.fabric.microsoft.com,1433;
Database=ops_lakehouse;
Authentication=Active Directory Managed Identity
```

The API's `/api/insights/operations` endpoint runs the aggregate query and
caches the result for ~5 minutes. The FE consumes the same contract
(`OperationsInsights`) it consumes for any other endpoint.

## Why this shape

- **Operators never wait on analytics.** Lakehouse queries run on Fabric
  compute, not on the transactional path.
- **Analysts and data scientists work in the Lakehouse already.** They can
  iterate on metric definitions in Notebooks / SQL and the app picks up the
  new view without code changes (table definitions stay stable; query in API
  evolves).
- **Power BI on the same data.** [ADR 0006](0006-power-bi-embed-via-service-principal.md)
  uses Power BI semantic models that sit on top of this Lakehouse — one set
  of metric definitions, two consumption surfaces (Power BI + our React UI).

## Consequences

- **+** Clean read/write separation. CQRS without the orchestration cost.
- **+** Managed Identity auth — no DB password in code, no rotation burden.
- **+** Same lake powers ML training pipelines (forecast model, gate
  recommender) — closes the loop with the model team.
- **−** Latency: lakehouse aggregates are not real-time. Acceptable for KPIs;
  not acceptable for the live alert stream (we keep that in the transactional
  store).
- **−** Fabric capacity (F2+) is a real cost (~CA$300/mo minimum). For the
  demo we mock; for production this is a stakeholder decision.

## Implementation in this demo

- Contract: [`packages/contracts/src/insights.ts`](../../packages/contracts/src/insights.ts)
- API: [`apps/api/src/routes/insights.ts`](../../apps/api/src/routes/insights.ts)
  with the real T-SQL pattern documented inline in
  [`apps/api/src/services/insights-service.ts`](../../apps/api/src/services/insights-service.ts).
- FE: [`apps/web/src/pages/InsightsPage.tsx`](../../apps/web/src/pages/InsightsPage.tsx)
  shows the source attribution badge so reviewers can see the Fabric
  integration intent.
- To wire a real Lakehouse:
  1. Provision Fabric F2+ capacity, create `ops_lakehouse` workspace.
  2. Set up Fabric Mirroring or Eventstream from the transactional store.
  3. Grant the App Service's Managed Identity Lakehouse Viewer role.
  4. Replace the mock branch in `insights-service.ts` with `tedious` or
     `mssql` connection using `@azure/identity` `DefaultAzureCredential`.
  5. Cache results in-memory or via Azure Redis with a 5-minute TTL.

## UI labeling policy (demo vs live)

The contract carries an explicit `mode: 'demo' | 'live'` field so the FE can
distinguish synthesized responses from real Lakehouse queries. We adopt this
policy because a reviewer who looks only at the rendered page must never be
misled about whether the data is real.

Rules:

1. The mode is set by the server, not the client. There is no way for the FE
   to silently render demo data as live.
2. When `mode === 'demo'`:
   - The header badge is **amber**, not brand-blue, with the text "Demo data ·
     awaiting Fabric capacity".
   - The target Lakehouse name is shown beneath the badge as "Target: …", not
     "Source: …".
   - The SQL panel header reads "View **target** T-SQL" and includes an
     amber banner: "this SQL is shown for design review only".
   - The footer reads "Demo mode" and explains how to flip to live.
3. When `mode === 'live'`:
   - The header badge is brand-blue and reads "Source: …".
   - The SQL panel reads "View **executed** T-SQL".
4. The server flips `mode` from `'demo'` to `'live'` only by replacing the
   mock branch in `insights-service.ts` with a real T-SQL call. There is no
   environment variable that silently swaps behavior — the change is a code
   change and a deploy, fully visible in git history.

This keeps every visible surface honest and removes the risk of a polished
demo being mistaken for a working integration.

## Alternatives considered

- **All-in on the transactional store** — simplest, but heavy aggregate
  queries compete with live operator traffic. Not viable past pilot.
- **Materialized views in Azure SQL** — works at small scale, but loses the
  shared metric definitions with the data team and Power BI authors.
- **Synapse Serverless / external table over Parquet in ADLS** — viable, but
  the team is standardized on Fabric; using Synapse here splits the data
  platform.
