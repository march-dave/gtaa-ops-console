# GTAA Ops Console

Decision-support console for airport operations — a demo project showing how to
turn ML outputs, sensor data, and CV alerts into a maintainable application
with auditable workflows.

> Demo prepared for the GTAA Full Stack / Product Engineer interview.

**Live demo**: <https://gtaa-ops-a04931.azurewebsites.net>
&nbsp;·&nbsp; **API docs**: <https://gtaa-ops-a04931.azurewebsites.net/docs>
&nbsp;·&nbsp; **Health**: <https://gtaa-ops-a04931.azurewebsites.net/health>

Sign in via the **"Mock access"** dropdown at the top of the page
(Viewer / Duty Manager / Ops Manager). The mock auth swaps in for Entra ID in
local/demo mode — see `apps/api/src/plugins/auth.ts` and
[ADR 0004](docs/adr/0004-entra-id-app-roles-not-groups.md).

## What's inside

| Module                   | Purpose                                                                                   | Tier   |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------ |
| Passenger Flow Forecast  | Hourly P10/P50/P90 forecast per terminal, what-if controls, recommendation cards          | Deep   |
| Gate Allocation Approval | ML recommendations for flight↔gate matching with approve/reject/override + audit trail    | Deep   |
| Apron CV Alerts          | Stream of synthetic CV events (aircraft, GSE, safety zone) with ack/escalate/resolve flow | Deep   |
| Reports (Power BI)       | Embedded executive KPI board (embed token endpoint pattern)                               | Medium |
| Sensor Anomaly Strip     | Baggage / HVAC / runway sensors with anomaly scoring computed server-side                 | Medium |
| Audit Log                | Append-only trail of every operator action, filterable by actor / resource / time         | Cross  |

## Architecture

```
┌────────────┐  HTTP   ┌────────────┐
│  apps/web  │ ──────▶ │  apps/api  │
│ React+Vite │         │  Fastify   │
└────────────┘         └────────────┘
        │                    │
        └──────── @gtaa/contracts ───────┐
                   (Zod schemas + types)
                                         ▼
                                Swagger UI served at /docs
                                (built by Fastify from route schemas)
```

### Tech stack

- **Frontend**: React 18, Vite 6, Tailwind v4, React Router, TanStack Query
- **Backend**: Node 22, Fastify 5, Zod, fastify-type-provider-zod, Pino
- **Contracts**: shared Zod schemas in `packages/contracts` (one file per domain)
- **Auth**: MSAL-style. Mock mode in dev (header `X-Mock-User: viewer|duty|ops`), Entra ID for deploy
- **Infra (planned)**: Azure Static Web Apps (FE) + App Service Linux (API), Key Vault, App Insights, Bicep IaC, GitHub Actions CI

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture and
[`docs/adr/`](docs/adr/) for design decisions.

## Quickstart

```bash
pnpm install

# In two terminals:
pnpm --filter @gtaa/api dev             # API on http://localhost:8787
pnpm --filter @gtaa/web dev             # Web on http://localhost:5173
```

Open <http://localhost:5173/forecast> — pick a mock user from the top-right
dropdown.

### Verify the API directly

```bash
curl http://localhost:8787/health
curl -H "X-Mock-User: duty" http://localhost:8787/api/auth/me
curl -H "X-Mock-User: duty" \
  "http://localhost:8787/api/forecasts/passenger-flow?terminal=T3&horizonHours=12"
```

Swagger UI: <http://localhost:8787/docs>

## Layout

```
gtaa-ops-console/
├── apps/
│   ├── api/                # Fastify + TypeScript
│   └── web/                # React + Vite
├── packages/
│   └── contracts/          # Shared API schemas (Zod) — one file per domain
├── docs/
│   ├── ARCHITECTURE.md
│   ├── RUNBOOK.md
│   └── adr/                # Architecture Decision Records
└── infra/                  # (planned) Bicep + GitHub Actions
```

## Testing

```bash
pnpm --filter @gtaa/api test     # Fastify-inject tests covering auth, gates, CV, sensors, reports, insights, audit
pnpm typecheck                   # all workspaces
```
