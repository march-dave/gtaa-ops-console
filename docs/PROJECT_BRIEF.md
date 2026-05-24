# GTAA Ops Console - Project Brief

## Summary

GTAA Ops Console is an Azure-deployed decision-support application for airport
operations. It turns synthetic ML outputs, operational signals, and workflow
decisions into a maintainable full-stack product surface.

Live demo: https://gtaa-ops-a04931.azurewebsites.net

GitHub: https://github.com/march-dave/gtaa-ops-console

API docs: https://gtaa-ops-a04931.azurewebsites.net/docs

Health check: https://gtaa-ops-a04931.azurewebsites.net/health

## Why This Project Fits The Role

The role asks for a Full Stack / Product Engineer who can turn analytics and AI
outputs into reliable applications, APIs, dashboards, workflows, and integration
patterns. This project was built around that exact shape:

- React/TypeScript frontend for operational users.
- Node/Fastify backend with REST APIs.
- Shared request/response contracts using Zod schemas.
- Synthetic ML/analytics outputs consumed through APIs, not embedded in the UI.
- Approval, override, escalation, and audit workflows.
- Role-based access pattern aligned with Entra ID app roles.
- Azure App Service deployment.
- Microsoft Fabric and Power BI integration boundaries documented as ADRs.

## Demo Access

Use the "Mock access" dropdown in the top-right of the application.

| Role | Purpose |
| --- | --- |
| Viewer | Read-only access to operational screens |
| Duty Manager | Can approve/reject/override gate recommendations and act on CV alerts |
| Ops Manager | Higher-role operator view for protected workflows |

The mock role switcher stands in for Entra ID app roles in local/demo mode.
Backend routes still enforce authorization, so protected mutations are blocked
server-side for read-only users.

## Modules

| Module | What It Demonstrates |
| --- | --- |
| Passenger Forecast | Hourly P10/P50/P90 passenger-flow forecast per terminal with what-if controls |
| Gate Approval | ML-style gate recommendations with approve, reject, and override decisions |
| Apron CV | Server-Sent Events stream for synthetic computer-vision alerts |
| Sensors | Baggage, HVAC, runway friction, fuel pressure, and de-icing anomaly signals |
| Operations Insights | Microsoft Fabric Lakehouse analytics pattern for aggregated KPIs |
| Reports (Power BI) | Power BI Embedded token endpoint pattern with server-side credential boundary |
| Audit | Append-only trail of operator actions with actor, role, reason, before/after, and trace ID |

## Architecture

```text
React + Vite SPA
  |
  | HTTP / SSE
  v
Fastify API
  |
  | shared types and validators
  v
packages/contracts
  |
  | Zod schemas
  v
Stable API boundary
```

The frontend never contains model logic. It consumes API outputs such as
forecasts, recommendations, CV events, sensor statuses, and insight summaries.
The backend owns validation, authorization, data shaping, and audit recording.

## Technical Highlights

### Shared API Contracts

`packages/contracts` contains one Zod schema file per domain:

- `forecast.ts`
- `gates.ts`
- `cv.ts`
- `sensors.ts`
- `reports.ts`
- `insights.ts`
- `audit.ts`
- `auth.ts`

These schemas are used by the API for runtime validation and by the frontend
for TypeScript types. This keeps the UI and API aligned while leaving room to
swap synthetic services for real ML, data, or enterprise integrations later.

### Role-Based Workflows

The app models three roles:

- `Viewer`
- `DutyManager`
- `OpsManager`

The frontend disables protected actions for insufficient roles, but the
backend remains the source of truth with `requireAuth` and `requireRole`.

### Auditability

Every operational mutation is written to an audit trail:

- Gate recommendation approved
- Gate recommendation rejected
- Gate recommendation overridden
- CV event acknowledged
- CV event escalated
- CV event resolved

Audit entries include actor, role, action, resource, before/after snapshots,
reason, timestamp, and request trace ID.

### Azure Deployment

The demo is deployed to Azure App Service:

```text
https://gtaa-ops-a04931.azurewebsites.net
```

The current deployment is a pre-built zip deploy from the local workspace. A
GitHub Actions deployment workflow is a natural next step.

## Enterprise Integration Boundaries

This MVP intentionally uses synthetic data and mock enterprise integrations.
That was a deliberate tradeoff for a recruiter-facing demo: the goal is to
demonstrate product workflows, API contracts, authorization boundaries, and
Azure deployability without requiring real GTAA data, tenant credentials, or
paid Fabric/Power BI capacity.

| Integration | Current Demo Mode | Production Direction |
| --- | --- | --- |
| Entra ID | Mock role switcher | Validate Entra tokens and app roles |
| Power BI | Mock embed token endpoint | Service-principal-issued embed token via Key Vault and Managed Identity |
| Fabric | Synthetic analytics response | Query Lakehouse SQL analytics endpoint with Managed Identity |
| Persistence | In-memory store | Azure SQL, Cosmos DB, or another transactional store |
| Observability | Request IDs and structured API boundaries | Application Insights and OpenTelemetry |

## Suggested Interview Talking Points

- I designed the app around stable contracts so the UI is not coupled to
  prototype ML code.
- I kept model logic on the backend side and exposed only safe operational
  outputs to the frontend.
- I implemented workflow decisions as auditable mutations, not just dashboard
  visuals.
- I used mock Entra, Fabric, and Power BI integrations intentionally, because
  real tenant setup and licensing are not the right risk for a short demo.
- The production path is clear: replace synthetic services behind the same API
  contracts with real model services, data stores, Entra auth, Power BI, and
  Fabric.

## Validation

Current local checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The API test suite covers auth, gate decisions, CV flows, sensors, reports,
insights, and audit behavior.
