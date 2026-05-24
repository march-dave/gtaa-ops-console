import { useMemo, useState } from "react";
import type { AuditEvent, AuditResourceType } from "@gtaa/contracts";
import { useAudit } from "../lib/queries";
import { SelectField, type SelectOption } from "../components/SelectField";

const ACTION_STYLES: Record<string, { dot: string; label: string }> = {
  "recommendation.approved": { dot: "bg-emerald-500", label: "Approved" },
  "recommendation.rejected": { dot: "bg-red-500", label: "Rejected" },
  "recommendation.overridden": { dot: "bg-amber-500", label: "Overridden" },
  "cv_event.acknowledged": { dot: "bg-sky-500", label: "CV ack" },
  "cv_event.escalated": { dot: "bg-orange-500", label: "CV escalated" },
  "cv_event.resolved": { dot: "bg-slate-500", label: "CV resolved" },
  "sensor.alert_silenced": { dot: "bg-slate-500", label: "Sensor silenced" },
  "user.signed_in": { dot: "bg-slate-500", label: "Sign-in" },
};

type ResourceFilter = "all" | AuditResourceType;
type TimeFilter = "all" | "1h" | "24h";

const RESOURCE_OPTIONS: SelectOption<ResourceFilter>[] = [
  { value: "all", label: "All resources", description: "Every audit event" },
  { value: "gate_recommendation", label: "Gate recommendations", description: "Approve / reject / override" },
  { value: "cv_event", label: "CV events", description: "Ack / escalate / resolve" },
  { value: "sensor", label: "Sensors", description: "Alert silencing" },
  { value: "session", label: "Sessions", description: "Sign-in events" },
];

const TIME_OPTIONS: SelectOption<TimeFilter>[] = [
  { value: "all", label: "All time", description: "No time bound" },
  { value: "1h", label: "Last hour", description: "Past 60 minutes" },
  { value: "24h", label: "Last 24 hours", description: "Past day" },
];

function sinceIsoFor(filter: TimeFilter): string | undefined {
  if (filter === "all") return undefined;
  const ms = filter === "1h" ? 60 * 60_000 : 24 * 60 * 60_000;
  return new Date(Date.now() - ms).toISOString();
}

export function AuditPage() {
  const [resource, setResource] = useState<ResourceFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");

  const filter = useMemo(
    () => ({
      ...(resource !== "all" ? { resourceType: resource } : {}),
      ...(sinceIsoFor(time) ? { since: sinceIsoFor(time) } : {}),
      limit: 100,
    }),
    [resource, time]
  );

  const { data, isLoading, isError, error } = useAudit(filter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-slate-400">
          Append-only trail of every operator action. Every record carries a
          traceId linking back to the originating request.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-3">
        <SelectField
          label="Resource type"
          value={resource}
          options={RESOURCE_OPTIONS}
          onChange={setResource}
          menuClassName="min-w-72"
        />
        <SelectField
          label="Time range"
          value={time}
          options={TIME_OPTIONS}
          onChange={setTime}
          menuClassName="min-w-64"
        />
        <div className="flex items-end text-xs text-slate-500">
          <span>
            {data ? `${data.items.length} event${data.items.length === 1 ? "" : "s"} match` : "—"}
          </span>
        </div>
      </section>

      {isLoading && <div className="text-slate-400">Loading…</div>}
      {isError && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="rounded border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-500">
          No events match the current filter. Decide a gate recommendation or
          acknowledge a CV alert to populate this.
        </div>
      )}
      {data && data.items.length > 0 && <Timeline events={data.items} />}
    </div>
  );
}

function Timeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="relative space-y-3 border-l border-slate-800 pl-6">
      {events.map((e) => {
        const style = ACTION_STYLES[e.action] ?? {
          dot: "bg-slate-500",
          label: e.action,
        };
        const decision = decisionDelta(e);
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[1.6rem] mt-1 inline-block h-3 w-3 rounded-full ${style.dot}`}
              aria-hidden
            />
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="font-medium">{style.label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {e.resourceType}#{e.resourceId.slice(0, 8)}
                  </span>
                </div>
                <time className="text-xs text-slate-500">
                  {new Date(e.createdAt).toLocaleString("en-CA")}
                </time>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                by{" "}
                <span className="text-slate-200">{e.actorDisplayName}</span>{" "}
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                  {e.actorRole}
                </span>
              </div>
              {decision && (
                <div className="mt-1 text-xs text-slate-300">{decision}</div>
              )}
              {e.reason && (
                <div className="mt-1 text-xs text-slate-400">
                  Reason: <span className="text-slate-200">{e.reason}</span>
                </div>
              )}
              {e.traceId && (
                <div className="mt-1 font-mono text-[10px] text-slate-500">
                  traceId: {e.traceId}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function decisionDelta(e: AuditEvent): string | null {
  if (e.resourceType !== "gate_recommendation") return null;
  const after = e.after as { status?: string; overrideGateId?: string | null } | null;
  if (!after) return null;
  if (after.status === "overridden" && after.overrideGateId) {
    return `Re-routed to ${after.overrideGateId}`;
  }
  if (after.status === "approved") return "Accepted as recommended";
  if (after.status === "rejected") return "Rejected; gate left unassigned";
  return null;
}
