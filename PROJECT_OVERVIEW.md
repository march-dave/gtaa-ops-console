# GTAA Ops Console — Project Overview

**Live**: <https://gtaa-ops-a04931.azurewebsites.net>
**Repository**: <https://github.com/march-dave/gtaa-ops-console>
**API docs**: <https://gtaa-ops-a04931.azurewebsites.net/docs>

A decision-support console for airport operations. One screen where a Duty
Manager reviews ML forecasts, decides on gate-allocation recommendations,
acts on live apron CV alerts, monitors sensors, and reads operational
analytics — with every action recorded in an immutable audit log.

Built end-to-end as an honest representation of how the codebase would start
on day one of the role: a small working core with explicit extension points
where the enterprise wiring (Entra, Power BI, Fabric, Key Vault, GitHub
Actions) plugs in.

---

## Module map (with JD coverage)

| Module | What it does | JD bullet it addresses |
| --- | --- | --- |
| **Passenger Flow Forecast** | Hourly P10/P50/P90 forecast per terminal with what-if controls. Severity-tagged recommendation cards. | ML model outputs · data-heavy dashboards |
| **Gate Allocation Approval** | ML recommendations with approve / reject / override. Override requires a reason — saved to audit as model-team feedback. | Recommendations · approvals · action tracking · user feedback |
| **Apron CV Alerts** | Server-Sent Events stream of synthetic CV events. Acknowledge, escalate (with reason), or resolve. | Computer vision outputs · real-time signals |
| **Sensor Strip** | Baggage belt, HVAC, runway friction, fuel pressure, de-icing. Anomaly scoring computed server-side — never in the UI. | Sensor analytics · safe ML consumption |
| **Operations Insights** | Aggregate KPIs shaped like a Fabric Lakehouse response (forecast accuracy, override rate, alert distribution). Demo mode is explicitly badged. | Fabric / lakehouse-backed applications |
| **Reports (Power BI)** | Embedded executive KPI board pattern with a server-side embed-token endpoint using the service-principal flow. | Power BI integration |
| **Audit Log** | Immutable append-only trail. Filter by resource type and time window. Every record carries the originating request's traceId. | Audit · action tracking |

---

## Architecture choices

**Shared API contracts as a separate package.** `@gtaa/contracts` holds Zod
schemas for every request and response. The API validates them at the network
boundary; the React app imports the same types at compile time. A breaking
change fails both apps simultaneously — impossible to ship a half-migrated
system. _See ADR 0001._

**ML output kept out of the UI.** Models live behind a `services/` boundary.
The UI consumes the contract, never the model. When the model team iterates on
a forecast variant, the UI doesn't change unless the contract does. This is
the JD's "consume model outputs safely without embedding model logic in the
UI" line, expressed in code.

**Append-only audit.** Every approve / reject / override / escalate / resolve
writes an immutable `AuditEvent`. `before` and `after` snapshots, actor role,
override reason, and a traceId that links to the originating request log.
Schema-level constraints prevent updates in production. _See ADR 0003._

**Server-Sent Events for live alerts.** SSE reuses the same HTTP stack as REST
— same auth, same observability, no separate WebSocket negotiation, no
sticky-session story for App Service. Azure SignalR is documented as the
migration target if we outgrow this. _See ADR 0005._

**Role hierarchy via Entra app roles, not group claims.** RBAC is
`Viewer < DutyManager < OpsManager`. Routes check `requireRole(req,
"DutyManager")` server-side; the FE mirrors the check for UI affordances but
the server is the enforcement point. App roles defined in the app
registration — independent of AD group restructures. _See ADR 0004._

**Mock vs. live, explicitly labeled.** Insights, Power BI, and Fabric
integrations carry a `mode: 'demo' | 'live'` field on the contract. The UI
badges demo data in amber so reviewers can never mistake the demo state for
production data. _See ADR 0008._

---

## Production-readiness checklist

- **Live on Azure** — App Service Linux Node 22 (West US 3; Canada Central
  had a free-tier VM quota constraint, documented).
- **Tests** — 28 Fastify-inject tests covering auth, gates, CV, sensors,
  reports, insights, audit. Full suite under 500 ms.
- **Typecheck** — strict TypeScript across all workspaces with
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Structured logging** — Pino with per-request `traceId` propagated to
  every API error body, every audit record, and the `x-request-id` response
  header.
- **Consistent error contract** — typed `ApiError` shape with `code`,
  `message`, `traceId`, and optional `details`.
- **Documentation** — `ARCHITECTURE.md`, `RUNBOOK.md`, and 8 ADRs covering
  every load-bearing decision.

---

## What is intentionally mocked

To keep the boundary honest:

- **Entra ID** — mock auth in dev. The plugin has an explicit `AUTH_MODE=entra`
  branch with the JWT validation point flagged. Wire-up is a single code
  change once a tenant is provisioned.
- **Power BI** — endpoint returns a mock embed token. ADR 0006 documents the
  service-principal-via-Key-Vault flow end-to-end.
- **Fabric Lakehouse** — response is synthesized server-side and clearly
  badged `mode: "demo"` on the contract. ADR 0008 documents the T-SQL
  endpoint pattern with Managed Identity. Numbers visibly scale with the
  lookback window so the UI is exercising real query semantics.
- **Key Vault + Managed Identity** — Managed Identity is enabled on the App
  Service; no secrets are read yet because none exist in the demo. ADR 0006
  documents the pattern.
- **GitHub Actions CI/CD** — current deploy is manual `az webapp deploy`.
  Workflow YAML is the next addition.

Each of these is a single contract change away from being live — the
integration shape is in place; only credential or capacity provisioning is
pending.

---

## Suggested 5-minute walkthrough

1. Open <https://gtaa-ops-a04931.azurewebsites.net> — land on **Passenger
   Forecast**. Adjust security lanes / gates and watch the forecast respond.
2. Switch role to **Duty Manager** via the top-right dropdown.
3. Go to **Gate Approval** → override one recommendation (a reason is
   required).
4. Go to **Apron CV** → escalate a `safety_zone_breach` alert with a reason.
5. Go to **Audit** → both actions appear with traceId, role, and reason.
   Filter by **Resource type: CV events** to confirm filtering works.
6. Go to **Insights (Fabric)** → notice the **amber "Demo data"** badge.
   Change the lookback window — KPI numbers shift visibly. Expand "View
   target T-SQL" to see the parameterized query that would run against the
   Lakehouse.
7. Open **/docs** → Swagger UI built from the same Zod schemas the React app
   consumes.

---

## Stack

- **Frontend**: React 18 · Vite 6 · Tailwind v4 · TanStack Query · React Router
- **Backend**: Node 22 · Fastify 5 · Zod · Pino · fastify-type-provider-zod
- **Contracts**: pnpm workspace package, Zod schemas as the single source of truth
- **Tests**: Vitest with Fastify inject
- **Infra**: Azure App Service Linux, currently deployed with `az webapp deploy`
- **Documentation**: 8 ADRs in `docs/adr/`

---

## Repository layout

```
gtaa-ops-console/
├── apps/
│   ├── api/                # Fastify + TypeScript backend
│   └── web/                # React + Vite frontend
├── packages/
│   └── contracts/          # Shared API schemas (Zod) — one file per domain
├── docs/
│   ├── ARCHITECTURE.md
│   ├── RUNBOOK.md
│   └── adr/                # Architecture Decision Records (1–8)
└── infra/                  # (planned) Bicep + GitHub Actions
```

---

## How to read this project

Three angles depending on time:

- **2 minutes** — Open the live URL. Click through the seven sidebar items
  with the role dropdown.
- **15 minutes** — Add the GitHub repo. Open
  [`packages/contracts/src/gates.ts`](https://github.com/march-dave/gtaa-ops-console/blob/main/packages/contracts/src/gates.ts)
  to see how a domain is modeled. Open
  [`docs/adr/0003-audit-log-immutable-pattern.md`](https://github.com/march-dave/gtaa-ops-console/blob/main/docs/adr/0003-audit-log-immutable-pattern.md)
  to see how a load-bearing decision is captured.
- **60 minutes** — Clone, `pnpm install`, `pnpm --filter @gtaa/api test`,
  walk through the eight ADRs in order.

I'm available for a live walkthrough on any module or design choice.
