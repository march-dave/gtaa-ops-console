# ADR 0006 — Power BI embed via service principal (App-Owns-Data)

- **Status**: Accepted (implementation: pattern only; live embed requires a Power BI tenant)
- **Date**: 2026-05-23

## Context

Operations leadership wants an embedded KPI report in the console (passenger
volumes, on-time performance, gate utilization). Power BI offers two embedding
modes:

1. **User-Owns-Data** — embed runs as the signed-in user, who must have a Power
   BI Pro license and explicit access to the workspace.
2. **App-Owns-Data** (service principal) — a single Power BI Pro / PPU /
   Embedded SKU license is held by a service principal; the application
   issues short-lived embed tokens on behalf of the user.

## Decision

Use **App-Owns-Data with a service principal**, with the embed token issued
by the API (not the FE).

```
[Browser]
   │  POST /api/reports/embed-token { reportId }
   ▼
[API]
   │ 1. Read SP credentials from Key Vault (via Managed Identity)
   │ 2. Acquire AAD token for Power BI Service
   │ 3. POST .../reports/{reportId}/GenerateToken
   │    with optional identities (Row-Level Security)
   ▼
{ token, embedUrl, expiresAt }
   │
   ▼
[Browser] powerbi-client-react renders the report
```

## Consequences

- **+** Operators don't need individual Power BI Pro licenses. The role-based
  filtering is applied via RLS by passing the user's identity + roles in the
  GenerateToken call.
- **+** Secrets stay on the server side. The browser never sees the service
  principal credentials, only a scoped short-lived embed token.
- **+** Audit trail: every embed-token issue is one API request and goes
  through the same `audit` hook used elsewhere.
- **−** Requires either a Power BI Premium capacity, a Premium-Per-User license
  on the service principal, or Embedded SKU (A1+). The minimum cost is
  non-trivial — flagged as a stakeholder decision rather than a tech one.
- **−** Tokens expire (usually 1h). The FE must handle refresh — we'll do this
  by re-issuing on a timer (`token.expiresAt - now() < 5min` triggers refetch).

## Implementation in this demo

- The API endpoint
  [`POST /api/reports/embed-token`](../../apps/api/src/routes/reports.ts) is in
  place with the production code path documented in source comments.
- Because the demo doesn't have a real Power BI workspace, the endpoint returns
  a clearly-mock token (`MOCK.embed.token.replace-with-real-via-service-principal`).
- The FE [`ReportsPage`](../../apps/web/src/pages/ReportsPage.tsx) renders a
  placeholder explaining the pattern.
- To wire a real workspace:
  1. Create an AAD app registration, generate a client secret, store it in Key Vault.
  2. Add the service principal as a member of the Power BI workspace (Member or Contributor).
  3. Set `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_WORKSPACE_ID`,
     `POWERBI_REPORT_ID` env vars (client secret pulled from Key Vault at runtime).
  4. Replace the mock branch in `routes/reports.ts` with the real GenerateToken
     call (using `@azure/identity` + `axios` or the `powerbi-client` Node SDK).

## Alternatives considered

- **User-Owns-Data**: every operator needs a Power BI Pro license; doesn't scale
  for an operations floor.
- **Direct iframe to app.powerbi.com**: requires the operator to be signed
  into Power BI in the browser; breaks our SSO story.
- **Re-implement charts in the app**: viable for 1–2 charts (Recharts is
  already a dep), but Power BI's Fabric/lakehouse integration and DAX models
  are why the data team picked it — keeping reports in Power BI keeps the
  authoring loop with analysts, not engineers.

## Operational notes

- Embed tokens are not stored. Each request issues a fresh one.
- Per-user RLS: pass `identities: [{ username: user.oid, roles: user.roles, datasets: [...] }]`
  in the GenerateToken body. The user's identity must match a row-level
  security rule defined in the dataset.
- The API returns `503 SERVICE_UNAVAILABLE` if Power BI config is missing —
  this is intentional so misconfiguration fails loud in non-demo deployments.
