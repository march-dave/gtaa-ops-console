import { useMemo, useState } from "react";
import { AlertTriangle, Check, Plane, Shuffle, X } from "lucide-react";
import type {
  ApprovalActionInput,
  Flight,
  Gate,
  GateRecommendation,
} from "@gtaa/contracts";
import { useAuth } from "../auth/MockAuthProvider";
import {
  useDecideRecommendation,
  useFlights,
  useGates,
  useRecommendations,
} from "../lib/queries";
import { DecisionDialog } from "../components/DecisionDialog";

type Tab = "pending" | "history";

interface DialogState {
  recommendation: GateRecommendation;
  mode: "reject" | "override";
}

export function GateApprovalPage() {
  const { hasRole } = useAuth();
  const canDecide = hasRole("DutyManager");

  const [tab, setTab] = useState<Tab>("pending");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const gatesQ = useGates();
  const flightsQ = useFlights();
  const pendingQ = useRecommendations("pending");
  const allQ = useRecommendations();
  const decide = useDecideRecommendation();

  const flightById = useMemo(
    () => new Map<string, Flight>((flightsQ.data ?? []).map((f) => [f.id, f])),
    [flightsQ.data]
  );
  const gateById = useMemo(
    () => new Map<string, Gate>((gatesQ.data ?? []).map((g) => [g.id, g])),
    [gatesQ.data]
  );

  const history = useMemo(
    () =>
      (allQ.data ?? [])
        .filter((r) => r.status !== "pending")
        .sort((a, b) =>
          (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt)
        ),
    [allQ.data]
  );

  const runDecision = async (id: string, decision: ApprovalActionInput) => {
    setSubmitError(null);
    try {
      await decide.mutateAsync({ id, decision });
      setDialog(null);
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gate Allocation</h1>
          <p className="text-sm text-slate-400">
            ML-recommended flight ↔ gate assignments. Approve, reject, or
            override with a reason — every decision is logged for audit.
          </p>
        </div>
        {!canDecide && (
          <div className="flex items-center gap-2 rounded bg-amber-900/30 px-2 py-1 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            Viewer role — decisions disabled
          </div>
        )}
      </header>

      <div className="flex gap-1 border-b border-slate-800">
        {(["pending", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm capitalize ${
              tab === t
                ? "border-b-2 border-brand-500 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t}{" "}
            <span className="ml-1 text-xs text-slate-500">
              {t === "pending"
                ? (pendingQ.data?.length ?? "—")
                : history.length || "—"}
            </span>
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <PendingList
          recommendations={pendingQ.data ?? []}
          isLoading={pendingQ.isLoading}
          flightById={flightById}
          gateById={gateById}
          canDecide={canDecide}
          submitting={decide.isPending}
          onApprove={(rec) =>
            runDecision(rec.id, { action: "approve" })
          }
          onReject={(rec) => setDialog({ recommendation: rec, mode: "reject" })}
          onOverride={(rec) =>
            setDialog({ recommendation: rec, mode: "override" })
          }
        />
      )}

      {tab === "history" && (
        <HistoryList
          recommendations={history}
          isLoading={allQ.isLoading}
          flightById={flightById}
          gateById={gateById}
        />
      )}

      {dialog && (
        <DecisionDialog
          mode={dialog.mode}
          recommendation={dialog.recommendation}
          flight={flightById.get(dialog.recommendation.flightId)}
          gates={gatesQ.data ?? []}
          submitting={decide.isPending}
          error={submitError}
          onCancel={() => {
            setDialog(null);
            setSubmitError(null);
          }}
          onSubmit={(decision) => runDecision(dialog.recommendation.id, decision)}
        />
      )}
    </div>
  );
}

interface PendingListProps {
  recommendations: GateRecommendation[];
  isLoading: boolean;
  flightById: Map<string, Flight>;
  gateById: Map<string, Gate>;
  canDecide: boolean;
  submitting: boolean;
  onApprove: (rec: GateRecommendation) => void;
  onReject: (rec: GateRecommendation) => void;
  onOverride: (rec: GateRecommendation) => void;
}

function PendingList({
  recommendations,
  isLoading,
  flightById,
  gateById,
  canDecide,
  submitting,
  onApprove,
  onReject,
  onOverride,
}: PendingListProps) {
  if (isLoading) return <div className="text-slate-400">Loading…</div>;
  if (recommendations.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-500">
        No pending recommendations.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {recommendations.map((rec) => {
        const flight = flightById.get(rec.flightId);
        const gate = gateById.get(rec.suggestedGateId);
        return (
          <article
            key={rec.id}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plane className="h-4 w-4 text-brand-500" />
                  {flight ? (
                    <>
                      <span>{flight.flightNo}</span>
                      <span className="text-xs text-slate-500">
                        {flight.airline}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                        {flight.aircraftSize}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">{rec.flightId}</span>
                  )}
                </div>
                {flight && (
                  <div className="mt-1 text-xs text-slate-400">
                    {flight.origin} → {flight.destination} ·{" "}
                    {new Date(flight.scheduledTime).toLocaleString("en-CA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">suggested gate</div>
                <div className="text-lg font-semibold">
                  {gate ? `${gate.terminal} ${gate.code}` : rec.suggestedGateId}
                </div>
                <div className="text-xs text-slate-500">
                  confidence {(rec.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-300">{rec.rationale}</p>

            <ul className="mt-2 space-y-0.5 text-xs">
              {rec.constraints.map((c) => (
                <li
                  key={c.name}
                  className={c.satisfied ? "text-emerald-300" : "text-red-300"}
                >
                  {c.satisfied ? "✓" : "✗"} {c.name.replace(/_/g, " ")}
                  {c.detail ? (
                    <span className="text-slate-500"> — {c.detail}</span>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={!canDecide || submitting}
                onClick={() => onReject(rec)}
                className="flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                type="button"
                disabled={!canDecide || submitting}
                onClick={() => onOverride(rec)}
                className="flex items-center gap-1 rounded border border-amber-700 px-2.5 py-1 text-amber-300 hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Override
              </button>
              <button
                type="button"
                disabled={!canDecide || submitting}
                onClick={() => onApprove(rec)}
                className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

interface HistoryListProps {
  recommendations: GateRecommendation[];
  isLoading: boolean;
  flightById: Map<string, Flight>;
  gateById: Map<string, Gate>;
}

function HistoryList({
  recommendations,
  isLoading,
  flightById,
  gateById,
}: HistoryListProps) {
  if (isLoading) return <div className="text-slate-400">Loading…</div>;
  if (recommendations.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-500">
        No decisions yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
      {recommendations.map((rec) => {
        const flight = flightById.get(rec.flightId);
        const gate = gateById.get(rec.suggestedGateId);
        const overrideGate =
          rec.overrideGateId !== null ? gateById.get(rec.overrideGateId) : null;
        const finalGate = overrideGate ?? gate;
        const finalGateLabel = finalGate
          ? `${finalGate.terminal} ${finalGate.code}`
          : (rec.overrideGateId ?? rec.suggestedGateId);
        const decided = rec.decidedAt
          ? new Date(rec.decidedAt).toLocaleString("en-CA", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "—";
        return (
          <li key={rec.id} className="flex items-start gap-4 p-3 text-sm">
            <StatusBadge status={rec.status} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {flight ? flight.flightNo : rec.flightId}
                </span>
                <span className="text-xs text-slate-500">→</span>
                <span className="text-sm text-slate-200">{finalGateLabel}</span>
                {rec.status === "overridden" && gate && (
                  <span className="text-xs text-slate-500">
                    (was {gate.terminal} {gate.code})
                  </span>
                )}
              </div>
              {rec.decisionReason && (
                <div className="mt-0.5 text-xs text-slate-400">
                  Reason: {rec.decisionReason}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>{decided}</div>
              <div>{rec.decidedBy ?? "—"}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: GateRecommendation["status"] }) {
  const styles: Record<GateRecommendation["status"], string> = {
    pending: "bg-slate-700 text-slate-200",
    approved: "bg-emerald-700/40 text-emerald-300",
    rejected: "bg-red-800/40 text-red-300",
    overridden: "bg-amber-700/40 text-amber-200",
    expired: "bg-slate-800 text-slate-400",
  };
  return (
    <span
      className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}
