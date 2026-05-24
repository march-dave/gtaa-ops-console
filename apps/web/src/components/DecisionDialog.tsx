import { useEffect, useState } from "react";
import type {
  ApprovalActionInput,
  Flight,
  Gate,
  GateRecommendation,
} from "@gtaa/contracts";
import { SelectField, type SelectOption } from "./SelectField";

type Mode = "reject" | "override";

interface DecisionDialogProps {
  mode: Mode;
  recommendation: GateRecommendation;
  flight: Flight | undefined;
  gates: Gate[];
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (decision: ApprovalActionInput) => void;
}

export function DecisionDialog({
  mode,
  recommendation,
  flight,
  gates,
  submitting,
  error,
  onCancel,
  onSubmit,
}: DecisionDialogProps) {
  const [reason, setReason] = useState("");
  const [overrideGateId, setOverrideGateId] = useState("");

  useEffect(() => {
    setReason("");
    setOverrideGateId("");
  }, [mode, recommendation.id]);

  const compatible =
    flight === undefined
      ? gates
      : gates.filter(
          (g) =>
            g.id !== recommendation.suggestedGateId &&
            sizeRank(g.maxAircraftSize) >= sizeRank(flight.aircraftSize)
        );
  const gateOptions: SelectOption<string>[] = [
    {
      value: "",
      label: "Pick a gate",
      description: "Compatible gates only",
    },
    ...compatible.map((g) => ({
      value: g.id,
      label: `${g.terminal} ${g.code}`,
      description: `Max aircraft ${g.maxAircraftSize}`,
    })),
  ];

  const valid =
    reason.trim().length > 0 &&
    (mode === "reject" || overrideGateId.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 className="text-lg font-semibold">
          {mode === "reject" ? "Reject recommendation" : "Override gate"}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {flight && (
            <>
              Flight <span className="text-slate-200">{flight.flightNo}</span>{" "}
              ({flight.aircraftSize}) → suggested{" "}
              <span className="text-slate-200">
                {gates.find((g) => g.id === recommendation.suggestedGateId)?.code ??
                  recommendation.suggestedGateId}
              </span>
            </>
          )}
        </p>

        {mode === "override" && (
          <div className="mt-4">
            <SelectField
              label="New gate"
              value={overrideGateId}
              options={gateOptions}
              onChange={setOverrideGateId}
              menuClassName="max-h-72 overflow-y-auto"
            />
          </div>
        )}

        <label className="mt-4 block text-sm">
          <span className="block text-slate-400">
            Reason{" "}
            <span className="text-amber-400">(required — saved to audit)</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
            placeholder={
              mode === "reject"
                ? "Why is this recommendation not actionable?"
                : "Why is the alternative gate better?"
            }
          />
        </label>

        {error && (
          <div className="mt-3 rounded border border-red-800 bg-red-950/40 p-2 text-sm text-red-300">
            {error}
          </div>
        )}

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
            onClick={() =>
              onSubmit(
                mode === "reject"
                  ? { action: "reject", reason: reason.trim() }
                  : {
                      action: "override",
                      overrideGateId,
                      reason: reason.trim(),
                    }
              )
            }
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              mode === "reject"
                ? "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400"
                : "bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-amber-900 disabled:text-amber-700"
            } disabled:cursor-not-allowed`}
          >
            {submitting ? "Submitting…" : mode === "reject" ? "Reject" : "Override"}
          </button>
        </div>
      </div>
    </div>
  );
}

const sizeRank = (s: "S" | "M" | "L" | "XL"): number =>
  ({ S: 0, M: 1, L: 2, XL: 3 })[s];
