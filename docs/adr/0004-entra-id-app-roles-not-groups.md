# ADR 0004 — Entra ID app roles, not group claims

- **Status**: Accepted
- **Date**: 2026-05-23

## Context

The console needs three role tiers (`Viewer`, `DutyManager`, `OpsManager`) and
must authorize requests against them. Entra ID offers two ways to express
role membership in a token: **app roles** (defined on the app registration,
emitted as `roles` claim) and **security group membership** (emitted as
`groups` claim).

## Decision

Use **app roles**, not group claims.

App roles are defined in `infra/azure/entra-app-roles.bicep` and assigned to
users (or groups of users) via Enterprise Applications. Tokens include a
`roles: ["DutyManager"]` claim that the API reads directly.

## Consequences

- **+** Role names are application semantics, not IT-org concepts. Renaming
  the AD security group "GTAA-Ops-DM-T3" doesn't ripple into the API code.
- **+** Group claim size limit (~200 groups) is irrelevant. Users with deep
  AD group memberships still get a clean, app-scoped roles array.
- **+** Permissions can still be granted to AD security groups *by assigning
  the group to an app role* — the right operational pattern for IT, with the
  app code reading only the role names it knows.
- **+** Audit clarity: `actorRole` in audit events is the role *as the app
  understood it at decision time*, not a Group GUID.
- **−** A new role requires a small Bicep change + Enterprise App
  reassignment. Acceptable; roles change rarely.

## Implementation notes

- API: `requireRole(req, "DutyManager")` checks the `roles` claim and a
  rank-based comparison (`OpsManager > DutyManager > Viewer`).
- FE: same rank check in `MockAuthProvider.hasRole` — mirrors the server
  for UI affordances only; the server is always the enforcement point.
- Mock dev: three `X-Mock-User` keys map to fixed users with one role each.
