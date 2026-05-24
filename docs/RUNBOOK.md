# Runbook

Operational guide for on-call. Keep this short, scannable, and accurate.

## Service map

| Component        | Where                       | How to reach                    |
| ---------------- | --------------------------- | ------------------------------- |
| Web (FE)         | Azure Static Web Apps       | `https://gtaa-ops.example`      |
| API              | Azure App Service Linux     | `https://api.gtaa-ops.example`  |
| Logs / traces    | Azure Application Insights  | App Insights → "gtaa-ops"       |
| Secrets          | Azure Key Vault             | `kv-gtaa-ops-prod`              |
| Audit store      | Azure SQL `audit_events`    | RW only via Managed Identity    |

## Smoke tests

```bash
# 1. API liveness
curl -fsS https://api.gtaa-ops.example/health

# 2. API readiness
curl -fsS https://api.gtaa-ops.example/ready

# 3. Auth round-trip (requires a real Entra token in prod)
curl -fsS -H "Authorization: Bearer $TOKEN" \
  https://api.gtaa-ops.example/api/auth/me

# 4. Open-API spec served
curl -fsS https://api.gtaa-ops.example/docs/json | jq '.paths | keys'
```

## Common alerts

### `5xx rate > 1% over 5 min`

1. Open Application Insights, filter by `cloud_RoleName == "gtaa-ops-api"`.
2. Group failures by `customDimensions.code` (this is the `ApiError.code`).
3. Look up the **traceId** from the alert in `requests` table for the full
   request log and any custom events emitted in the same correlation.
4. If `VALIDATION_ERROR` dominates: a recent FE deploy may be sending an
   outdated payload — roll the FE back via Static Web Apps deployment slots.
5. If `INTERNAL_ERROR` dominates and started after an API deploy: roll the API
   back via App Service deployment slots, then investigate.

### `Forecast endpoint latency p95 > 2s`

- The forecast service is pure compute (no DB) and should be <100ms.
- If real model output is wired in: check the upstream model service health
  in the linked dashboard.
- If latency is server-side: scale up the App Service plan one tier (manual
  in the portal, IaC change to follow).

### `Audit write failures`

- Audit is non-blocking — the mutation still succeeds — but every failure is
  logged at `error` level with `cloud_RoleName == "gtaa-ops-api"` and the
  message `audit.write_failed`.
- Investigate Azure SQL connectivity (managed identity, firewall).
- **Never bypass the audit hook.** If audit is truly unreachable, take the
  API offline rather than serving traffic without auditability.

## Deploy

1. PRs deploy to a preview slot via GitHub Actions (`.github/workflows/preview.yml`).
2. Merging to `main` deploys to production slot; the workflow runs smoke tests
   against the production slot before swapping.
3. To roll back: in App Service → "Deployment slots" → swap back, or revert
   the merge and re-run the workflow.

## Manual escape hatches

- **Disable a feature module**: set `FEATURE_<NAME>_DISABLED=true` in App
  Service config and restart. The FE hides the module when the corresponding
  `/api/<module>/status` returns `disabled`.
- **Read-only mode**: set `READ_ONLY=true` — all mutations return 503 with
  body `{ code: "READ_ONLY" }`. Used during maintenance windows.

## Escalation

- L2 — Platform team (Slack `#gtaa-ops-platform`)
- L3 — ML team for model-output anomalies (`#gtaa-ml`)
- Outside hours — phone tree in PagerDuty service "gtaa-ops"
