# ADR 0005 — Real-time updates: Server-Sent Events

- **Status**: Accepted
- **Date**: 2026-05-23

## Context

The Apron CV module needs to push events (aircraft detections, GSE proximity,
safety-zone breaches) to operators as they happen. The choices for browser
real-time delivery are HTTP polling, WebSockets, and Server-Sent Events (SSE).

The traffic pattern is **server-to-client, one-way, low-rate** (a handful of
events per minute per camera) with a strong correctness requirement
(operators must not miss a critical event).

## Decision

Use **Server-Sent Events** (`text/event-stream`) over the same HTTP stack as
the REST endpoints. Wire it into Fastify via `reply.raw.write(...)` with a
small typed envelope (`CvStreamEvent` in `@gtaa/contracts`).

The contract supports four message kinds: `snapshot` (initial backlog on
connect), `created`, `updated`, and `heartbeat`. The store keeps a bounded
history and delivers the snapshot synchronously when a client subscribes, so
operators see context immediately rather than waiting for the next tick.

## Consequences

- **+** Re-uses the existing HTTP path: same auth, same CORS, same
  observability, same App Service hosting. WebSockets would require a
  different sticky-routing story on Azure App Service.
- **+** Browser EventSource handles reconnection and `Last-Event-ID` for
  free; we can layer event replay on top later by including IDs in the
  framing.
- **+** Tiny server-side footprint: one `Set<Listener>` per process, no
  protocol upgrade negotiation, easy to test (the store's `subscribe` is a
  plain function — see [`cv-stream.ts`](../../apps/api/src/plugins/cv-stream.ts)).
- **−** EventSource cannot set custom headers. We work around this by
  accepting a `?mockUser=` query param in development. In production with
  Entra, the bearer token can be issued via a cookie (HttpOnly,
  SameSite=strict) so the same constraint is satisfied without query-string
  secrets.
- **−** Strictly one-way. Client→server commands still go through REST
  (`POST /api/cv-events/:id/action`). This is intentional: it keeps the
  audit/RBAC path identical for live and historical actions.
- **−** Long-lived connections need to be drained gracefully on deploys.
  We close idle streams on `SIGTERM` (Fastify `onClose`) so App Service slot
  swaps don't leave hanging sockets.

## Alternatives considered

- **Polling** (`GET /api/cv-events` every N seconds): simplest, fits in the
  same client model as everything else, but adds 1–5s latency on a critical
  alert and burns 60× more requests per hour at our event rate. Acceptable
  fallback if SSE has to be disabled (e.g., behind a strict proxy).
- **WebSockets**: bi-directional, but we don't need C2S over the same socket.
  Adds protocol complexity, needs sticky sessions on multi-instance App
  Service, and complicates observability (App Insights treats WS as one long
  request).
- **Azure SignalR Service**: managed pub/sub on top of WebSockets, scales
  past App Service in-process limits. Right answer if we go multi-tenant or
  multi-region. Documented here as the migration target if the simple SSE
  model hits its limits.

## Operational notes

- Heartbeat every 15s keeps proxies from idling the connection out.
- `X-Accel-Buffering: no` disables nginx/Front-Door response buffering.
- The ticker is **disabled when `NODE_ENV=test`** so vitest runs are
  deterministic.
