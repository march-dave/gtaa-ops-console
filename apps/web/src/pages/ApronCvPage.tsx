import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowUpRight,
  Check,
  CircleDot,
  Eye,
  Plane,
  WifiOff,
} from "lucide-react";
import type {
  CvActionInput,
  CvEvent,
  CvEventStatus,
  CvSeverity,
} from "@gtaa/contracts";

import { useAuth } from "../auth/MockAuthProvider";
import { apiFetch } from "../lib/api";
import { useCvStream } from "../lib/useCvStream";

const STATUS_FILTERS: { key: "all" | CvEventStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "escalated", label: "Escalated" },
  { key: "resolved", label: "Resolved" },
];

const SEVERITY_FILTERS: { key: "all" | CvSeverity; label: string }[] = [
  { key: "all", label: "All severities" },
  { key: "critical", label: "Critical" },
  { key: "warn", label: "Warn" },
  { key: "info", label: "Info" },
];

export function ApronCvPage() {
  const { hasRole } = useAuth();
  const canAct = hasRole("DutyManager");

  const stream = useCvStream();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | CvEventStatus>("new");
  const [severityFilter, setSeverityFilter] = useState<"all" | CvSeverity>("all");
  const [escalateFor, setEscalateFor] = useState<CvEvent | null>(null);
  const [escalateReason, setEscalateReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CvActionInput }) =>
      apiFetch<CvEvent>(`/api/cv-events/${id}/action`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const filtered = useMemo(() => {
    let items = stream.events;
    if (statusFilter !== "all") items = items.filter((e) => e.status === statusFilter);
    if (severityFilter !== "all") {
      items = items.filter((e) => e.severity === severityFilter);
    }
    return items;
  }, [stream.events, statusFilter, severityFilter]);

  const counts = useMemo(() => {
    const c = { all: stream.events.length, new: 0, acknowledged: 0, escalated: 0, resolved: 0 };
    for (const e of stream.events) c[e.status] += 1;
    return c;
  }, [stream.events]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Apron CV Alerts</h1>
          <p className="text-sm text-slate-400">
            Live stream of synthetic CV events (aircraft, GSE, safety-zone).
            Acknowledge, escalate with a reason, or resolve — every action is audited.
          </p>
        </div>
        <ConnectionBadge connected={stream.connected} heartbeat={stream.lastHeartbeat} />
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              statusFilter === f.key
                ? "bg-brand-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f.label}
            <span className="ml-1 text-[10px] text-slate-300/80">
              {f.key === "all" ? counts.all : counts[f.key]}
            </span>
          </button>
        ))}
        <span className="mx-2 h-6 w-px bg-slate-700" />
        {SEVERITY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setSeverityFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              severityFilter === f.key
                ? "bg-amber-500 text-slate-950"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {stream.error && !stream.connected && (
        <div className="rounded border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          {stream.error} — the stream will reconnect automatically.
        </div>
      )}

      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-500">
          No events match the current filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <CvEventRow
              key={e.id}
              event={e}
              canAct={canAct}
              submitting={action.isPending}
              onAcknowledge={() => {
                setError(null);
                action.mutate({ id: e.id, body: { action: "acknowledge" } });
              }}
              onEscalate={() => {
                setError(null);
                setEscalateFor(e);
                setEscalateReason("");
              }}
              onResolve={() => {
                setError(null);
                action.mutate({ id: e.id, body: { action: "resolve" } });
              }}
            />
          ))}
        </ul>
      )}

      {escalateFor && (
        <EscalateDialog
          event={escalateFor}
          reason={escalateReason}
          onReasonChange={setEscalateReason}
          submitting={action.isPending}
          onCancel={() => setEscalateFor(null)}
          onSubmit={async () => {
            try {
              await action.mutateAsync({
                id: escalateFor.id,
                body: { action: "escalate", reason: escalateReason.trim() },
              });
              setEscalateFor(null);
            } catch {
              /* error already captured */
            }
          }}
        />
      )}
    </div>
  );
}

interface CvEventRowProps {
  event: CvEvent;
  canAct: boolean;
  submitting: boolean;
  onAcknowledge: () => void;
  onEscalate: () => void;
  onResolve: () => void;
}

function CvEventRow({
  event,
  canAct,
  submitting,
  onAcknowledge,
  onEscalate,
  onResolve,
}: CvEventRowProps) {
  const Icon = ICON_BY_TYPE[event.eventType];
  return (
    <li
      className={`flex items-start gap-4 rounded-lg border p-3 ${
        SEVERITY_BORDER[event.severity]
      } bg-slate-900/40`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${SEVERITY_ICON[event.severity]}`} />
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium capitalize">
            {event.eventType.replace(/_/g, " ")}
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {event.severity}
          </span>
          <span className="text-xs text-slate-400">{event.standCode}</span>
          <span className="text-xs text-slate-500">{event.cameraId}</span>
          <span className="ml-auto text-xs text-slate-500">
            {new Date(event.detectedAt).toLocaleTimeString("en-CA")}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          confidence {(event.payload.confidence * 100).toFixed(0)}%
          {event.payload.notes && (
            <> · <span className="text-slate-300">{event.payload.notes}</span></>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill status={event.status} />
          {event.acknowledgedBy && (
            <span className="text-xs text-slate-500">
              ack by {event.acknowledgedBy}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
        <button
          type="button"
          disabled={!canAct || submitting || event.status !== "new"}
          onClick={onAcknowledge}
          className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3 w-3" /> Ack
        </button>
        <button
          type="button"
          disabled={!canAct || submitting || event.status === "resolved"}
          onClick={onEscalate}
          className="flex items-center gap-1 rounded border border-orange-700 px-2 py-1 text-orange-300 hover:bg-orange-900/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUpRight className="h-3 w-3" /> Escalate
        </button>
        <button
          type="button"
          disabled={!canAct || submitting || event.status === "resolved"}
          onClick={onResolve}
          className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-emerald-50 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CircleDot className="h-3 w-3" /> Resolve
        </button>
      </div>
    </li>
  );
}

const ICON_BY_TYPE: Record<CvEvent["eventType"], typeof Plane> = {
  aircraft_arrival: Plane,
  aircraft_departure: Plane,
  gse_proximity: Eye,
  safety_zone_breach: AlertOctagon,
  fod_detected: Eye,
  person_in_restricted_area: AlertOctagon,
};

const SEVERITY_BORDER: Record<CvSeverity, string> = {
  info: "border-slate-800",
  warn: "border-amber-900/60",
  critical: "border-red-900/60",
};

const SEVERITY_ICON: Record<CvSeverity, string> = {
  info: "text-slate-400",
  warn: "text-amber-300",
  critical: "text-red-300",
};

function StatusPill({ status }: { status: CvEventStatus }) {
  const styles: Record<CvEventStatus, string> = {
    new: "bg-slate-700 text-slate-200",
    acknowledged: "bg-sky-900/40 text-sky-300",
    escalated: "bg-orange-900/40 text-orange-300",
    resolved: "bg-emerald-900/40 text-emerald-300",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

function ConnectionBadge({
  connected,
  heartbeat,
}: {
  connected: boolean;
  heartbeat: string | null;
}) {
  if (!connected) {
    return (
      <div className="flex items-center gap-2 rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">
        <WifiOff className="h-3 w-3" /> Disconnected
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded bg-emerald-900/30 px-2 py-1 text-xs text-emerald-300">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      Live
      {heartbeat && (
        <span className="text-emerald-400/60">
          · hb {new Date(heartbeat).toLocaleTimeString("en-CA")}
        </span>
      )}
    </div>
  );
}

interface EscalateDialogProps {
  event: CvEvent;
  reason: string;
  onReasonChange: (v: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function EscalateDialog({
  event,
  reason,
  onReasonChange,
  submitting,
  onCancel,
  onSubmit,
}: EscalateDialogProps) {
  const valid = reason.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Escalate event</h2>
        <p className="mt-1 text-xs text-slate-400">
          {event.eventType.replace(/_/g, " ")} at {event.standCode} —{" "}
          {event.severity}
        </p>
        <label className="mt-4 block text-sm">
          <span className="block text-slate-400">
            Reason{" "}
            <span className="text-amber-400">(required — saved to audit)</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            placeholder="What did you confirm? Who is on it?"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || submitting}
            onClick={onSubmit}
            className="rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-orange-900 disabled:text-orange-700"
          >
            {submitting ? "Submitting…" : "Escalate"}
          </button>
        </div>
      </div>
    </div>
  );
}
