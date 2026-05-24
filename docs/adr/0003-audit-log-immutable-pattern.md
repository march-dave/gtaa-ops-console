# ADR 0003 — Audit log as immutable append-only events

- **Status**: Accepted
- **Date**: 2026-05-23

## Context

A regulated operational tool needs an answer to "who did what, when, why, and
against which version of the data?" — for retrospectives, dispute resolution,
and compliance. The naive approach (a `last_modified_by` column per row) loses
history, hides overrides, and gives no useful answer when a model recommendation
is later questioned.

## Decision

Every mutation writes an **AuditEvent** to an append-only log. The mutation
itself updates state; the audit record is the journal of what changed.

```
AuditEvent {
  id, actorId, actorRole, action,
  resourceType, resourceId,
  before, after, reason,
  traceId, createdAt
}
```

Rules:

1. The audit record is written in the same code path as the mutation, through
   the `audit` Fastify plugin. There is no route that bypasses it.
2. `before` and `after` are full JSON snapshots, not deltas. Storage is cheap;
   reconstructing intent from a delta years later is not.
3. Records are never updated or deleted by application code. Schema-level
   constraints (`DENY UPDATE/DELETE` on the table) enforce this in production.
4. `traceId` matches the originating request log, so every audit row links to
   the full request context in App Insights.
5. For decisions that override an ML recommendation, `reason` is **required**
   at the API contract level — captured as feedback for the model team.

## Consequences

- **+** Full reconstruction of state at any point in time by replaying events.
- **+** Override reasons accumulate as labeled training data for the model team.
- **+** Investigations resolve in minutes ("filter by `actor=…` and
  `resource=gate-rec-42`") rather than spelunking through deploy logs.
- **−** Storage grows linearly with activity. Mitigated by tiering older
  audit records to cool storage; never deleted.
- **−** Schema changes to `before`/`after` payloads must be backward-readable.
  Old payloads stay queryable as the schema evolves.

## What this is *not*

This is an operational audit log, not an application event-source store. We
don't reconstruct state from events at read time — we keep both a relational
state table (current state) and the audit log (history).
