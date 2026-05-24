import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  RefreshCw,
} from "lucide-react";
import type { OperationsInsights } from "@gtaa/contracts";

import { apiFetch } from "../lib/api";
import { SelectField, type SelectOption } from "../components/SelectField";

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtInt = (n: number) => n.toLocaleString();

const LOOKBACK_OPTIONS: SelectOption<string>[] = [
  { value: "1", label: "Last hour", description: "60 minutes" },
  { value: "6", label: "Last 6 hours", description: "Short window" },
  { value: "24", label: "Last 24 hours", description: "Default" },
  { value: "168", label: "Last 7 days", description: "Wider sample" },
];

const REFRESH_INTERVAL_SEC = 30;

export function InsightsPage() {
  const [lookback, setLookback] = useState<string>("24");
  const [showSql, setShowSql] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_SEC);

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery<OperationsInsights>({
    queryKey: ["insights", lookback],
    queryFn: () =>
      apiFetch<OperationsInsights>(
        `/api/insights/operations?lookbackHours=${lookback}`
      ),
    refetchInterval: REFRESH_INTERVAL_SEC * 1000,
  });

  // Countdown until next auto-refresh.
  useEffect(() => {
    setSecondsUntilRefresh(REFRESH_INTERVAL_SEC);
    const id = setInterval(() => {
      setSecondsUntilRefresh((s) => (s <= 1 ? REFRESH_INTERVAL_SEC : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  const countdownLabel = useMemo(() => {
    const m = Math.floor(secondsUntilRefresh / 60);
    const s = secondsUntilRefresh % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [secondsUntilRefresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Operations Insights</h1>
          <p className="text-sm text-slate-400">
            Aggregated analytics shaped like a Fabric Lakehouse response.
            Numbers refresh every {REFRESH_INTERVAL_SEC}s — change the lookback
            window or click Refresh for an immediate re-query.
          </p>
        </div>
        {data && <ModeBadge data={data} />}
      </header>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-[1fr_auto_auto]">
        <SelectField<string>
          label="Lookback window"
          value={lookback}
          options={LOOKBACK_OPTIONS}
          onChange={setLookback}
          menuClassName="min-w-64"
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-10 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>{isFetching ? "Querying…" : "Refresh"}</span>
          </button>
        </div>
        <div className="flex items-end text-xs text-slate-500">
          <span>Next auto-refresh in <span className="tabular-nums text-slate-300">{countdownLabel}</span></span>
        </div>
      </section>

      {isLoading && <div className="text-slate-400">Querying Lakehouse…</div>}
      {isError && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-md border border-slate-800 bg-slate-900/30 px-3 py-2 text-xs text-slate-400">
            <span>
              <span className="text-slate-500">Window:</span>{" "}
              <span className="text-slate-200">{data.lookbackHours}h</span>
            </span>
            <span>·</span>
            <span>
              <span className="text-slate-500">Query duration:</span>{" "}
              <span className="tabular-nums text-slate-200">{data.queryDurationMs} ms</span>
            </span>
            <span>·</span>
            <span>
              <span className="text-slate-500">Generated:</span>{" "}
              <time className="tabular-nums text-slate-200">
                {new Date(data.generatedAt).toLocaleTimeString("en-CA", {
                  hour12: false,
                })}
              </time>
            </span>
            {isFetching && (
              <span className="ml-auto flex items-center gap-1 text-brand-500">
                <RefreshCw className="h-3 w-3 animate-spin" />
                live re-query
              </span>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              title="Forecast accuracy"
              value={fmtPct(data.kpis.forecastAccuracyP50)}
              hint="Hours where actual fell inside P10–P90"
            />
            <KpiCard
              title="Override rate"
              value={fmtPct(data.kpis.recommendationOverrideRate)}
              hint="Gate recommendations overridden by ops"
            />
            <KpiCard
              title={`CV alerts (${data.lookbackHours}h)`}
              value={fmtInt(data.kpis.cvAlertsLast24h)}
              hint="Across all stands and cameras"
            />
            <KpiCard
              title={`Sensor anomalies (${data.lookbackHours}h)`}
              value={fmtInt(data.kpis.sensorAnomaliesLast24h)}
              hint="Score ≥ 0.55 across all sensors"
            />
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">
              CV alerts by hour (most recent 24h slice)
            </h2>
            <HourBarChart buckets={data.cvAlertsByHour} />
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">
              Top anomalous sensors
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-medium">Sensor</th>
                  <th className="py-2 font-medium">ID</th>
                  <th className="py-2 text-right font-medium">
                    Anomalies ({data.lookbackHours}h)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.topAnomalousSensors.map((s) => (
                  <tr key={s.sensorId}>
                    <td className="py-2">{s.sensorName}</td>
                    <td className="py-2 font-mono text-xs text-slate-500">{s.sensorId}</td>
                    <td className="py-2 text-right tabular-nums">{s.anomalyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/40">
            <button
              type="button"
              onClick={() => setShowSql((s) => !s)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-slate-800/40"
            >
              {showSql ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              View {data.mode === "live" ? "executed" : "target"} T-SQL
              <span className="ml-2 text-xs text-slate-500">
                {data.mode === "live"
                  ? "(the query this request ran against the Lakehouse)"
                  : "(the query that would run once Fabric is wired)"}
              </span>
            </button>
            {showSql && (
              <>
                {data.mode === "demo" && (
                  <div className="border-t border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900">
                    Demo mode — this SQL is shown for design review only. It is
                    not executed; the response above is synthesized server-side.
                  </div>
                )}
                <pre className="overflow-x-auto border-t border-slate-800 bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-300">
{data.executedQuery}
                </pre>
              </>
            )}
          </section>

          <footer className="rounded border border-dashed border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-500">
            {data.mode === "live" ? (
              <p>
                Queries hit{" "}
                <code className="text-slate-300">{data.lakehouseName}</code>{" "}
                over a T-SQL endpoint with Managed Identity (no secrets in
                code). Power BI semantic models on
                <code className="ml-1 text-slate-300">docs/adr/0006</code> sit
                on the same Lakehouse — one metric definition, two surfaces.
              </p>
            ) : (
              <p>
                <span className="font-semibold text-amber-700">Demo mode.</span>{" "}
                The integration pattern is wired end-to-end (contract, API
                shape, FE rendering) but the response is synthesized
                server-side. To go live, provision a Fabric F2+ capacity, point
                the API at the Lakehouse T-SQL endpoint with Managed Identity,
                and flip <code className="text-slate-300">mode</code> from{" "}
                <code className="text-slate-300">"demo"</code> to{" "}
                <code className="text-slate-300">"live"</code>.
              </p>
            )}
            <p className="mt-1">
              See{" "}
              <code className="text-slate-300">docs/adr/0008-fabric-lakehouse-integration.md</code>{" "}
              for the integration pattern and the demo-vs-live labeling policy.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}

function ModeBadge({ data }: { data: OperationsInsights }) {
  if (data.mode === "live") {
    return (
      <div className="flex flex-col items-end gap-1 text-xs">
        <div className="flex items-center gap-2 rounded-md border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-brand-500">
          <Database className="h-3.5 w-3.5" />
          <span>
            Source: <span className="font-medium">{data.lakehouseName}</span>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="font-medium">Demo data · awaiting Fabric capacity</span>
      </div>
      <div className="flex items-center gap-2 text-slate-500">
        <Database className="h-3 w-3" />
        <span>
          Target: <span className="text-slate-400">{data.lakehouseName}</span>
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function HourBarChart({
  buckets,
}: {
  buckets: { hour: number; count: number }[];
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="grid grid-cols-12 gap-1 md:grid-cols-24">
      {buckets.map((b) => {
        const h = (b.count / max) * 100;
        return (
          <div key={b.hour} className="flex flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t bg-brand-500/70"
                style={{ height: `${h}%` }}
                title={`${b.hour}:00 — ${b.count} alerts`}
              />
            </div>
            <div className="text-[10px] tabular-nums text-slate-500">
              {String(b.hour).padStart(2, "0")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
