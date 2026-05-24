import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PassengerFlowForecast, Terminal } from "@gtaa/contracts";
import { apiFetch } from "../lib/api";
import { SelectField, type SelectOption } from "../components/SelectField";

const TERMINAL_OPTIONS: SelectOption<Terminal>[] = [
  { value: "T1", label: "Terminal 1", description: "Domestic / international" },
  { value: "T3", label: "Terminal 3", description: "International flow" },
];

interface WhatIfState {
  extraSecurityLanes: number;
  extraGates: number;
}

export function ForecastPage() {
  const [terminal, setTerminal] = useState<Terminal>("T3");
  const [horizon, setHorizon] = useState<number>(12);
  const [whatIf, setWhatIf] = useState<WhatIfState>({
    extraSecurityLanes: 0,
    extraGates: 0,
  });

  const params = new URLSearchParams({
    terminal,
    horizonHours: String(horizon),
  });
  if (whatIf.extraSecurityLanes > 0) {
    params.set("extraSecurityLanes", String(whatIf.extraSecurityLanes));
  }
  if (whatIf.extraGates > 0) {
    params.set("extraGates", String(whatIf.extraGates));
  }

  const { data, isLoading, isError, error } = useQuery<PassengerFlowForecast>({
    queryKey: ["forecast", terminal, horizon, whatIf],
    queryFn: () =>
      apiFetch<PassengerFlowForecast>(
        `/api/forecasts/passenger-flow?${params.toString()}`
      ),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Passenger Flow Forecast</h1>
          <p className="text-sm text-slate-400">
            Synthetic ML output. P10 / P50 / P90 bands per hour with what-if controls.
          </p>
        </div>
        {data && (
          <div className="text-xs text-slate-500">
            model <span className="text-slate-300">{data.modelVersion}</span> ·
            generated{" "}
            <span className="text-slate-300">
              {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-4">
        <div className="text-sm">
          <SelectField
            label="Terminal"
            value={terminal}
            options={TERMINAL_OPTIONS}
            onChange={setTerminal}
            compact
            showSelectedDescription={false}
            menuClassName="min-w-64"
          />
        </div>
        <label className="text-sm">
          <span className="block text-slate-400">Horizon (h)</span>
          <input
            type="number"
            min={1}
            max={24}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400">+ Security lanes</span>
          <input
            type="number"
            min={0}
            max={5}
            value={whatIf.extraSecurityLanes}
            onChange={(e) =>
              setWhatIf((s) => ({ ...s, extraSecurityLanes: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-400">+ Gates</span>
          <input
            type="number"
            min={0}
            max={5}
            value={whatIf.extraGates}
            onChange={(e) =>
              setWhatIf((s) => ({ ...s, extraGates: Number(e.target.value) }))
            }
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
          />
        </label>
      </section>

      {isLoading && <div className="text-slate-400">Loading…</div>}
      {isError && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">
              Hourly forecast ({data.points.length} points)
            </h2>
            <ForecastTable points={data.points} />
          </section>

          {data.recommendations.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-slate-300">Recommendations</h2>
              {data.recommendations.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 ${
                    r.severity === "critical"
                      ? "border-red-800 bg-red-950/40"
                      : r.severity === "warn"
                        ? "border-amber-800 bg-amber-950/30"
                        : "border-slate-800 bg-slate-900/40"
                  }`}
                >
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="text-sm text-slate-300">{r.message}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Suggested: {r.suggestedAction}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ForecastTable({
  points,
}: {
  points: PassengerFlowForecast["points"];
}) {
  const maxP90 = Math.max(...points.map((p) => p.p90), 1);
  return (
    <div className="space-y-1">
      {points.map((p) => {
        const widthP90 = (p.p90 / maxP90) * 100;
        const widthP50 = (p.p50 / maxP90) * 100;
        const widthP10 = (p.p10 / maxP90) * 100;
        return (
          <div key={p.timestamp} className="grid grid-cols-[7rem_1fr_8rem] items-center gap-3 text-xs">
            <div className="text-slate-400">
              {new Date(p.timestamp).toLocaleString("en-CA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="relative h-4 overflow-hidden rounded bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 bg-brand-500/15"
                style={{ width: `${widthP90}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-brand-500/40"
                style={{ width: `${widthP50}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-brand-500/70"
                style={{ width: `${widthP10}%` }}
              />
            </div>
            <div className="text-right tabular-nums text-slate-300">
              {p.p50.toLocaleString()} pax
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex gap-3 text-xs text-slate-500">
        <span><span className="inline-block h-2 w-2 rounded bg-brand-500/70" /> P10</span>
        <span><span className="inline-block h-2 w-2 rounded bg-brand-500/40" /> P50</span>
        <span><span className="inline-block h-2 w-2 rounded bg-brand-500/15" /> P90</span>
      </div>
    </div>
  );
}
