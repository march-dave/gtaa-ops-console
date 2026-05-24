import { useQuery } from "@tanstack/react-query";
import type { SensorReading, SensorStatus } from "@gtaa/contracts";

import { apiFetch } from "../lib/api";

const STATUS_COLOR: Record<SensorStatus["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-400",
  alert: "bg-red-500",
  offline: "bg-slate-500",
};

const STATUS_TEXT: Record<SensorStatus["status"], string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  alert: "text-red-300",
  offline: "text-slate-400",
};

export function SensorsPage() {
  const { data, isLoading, isError, error } = useQuery<SensorStatus[]>({
    queryKey: ["sensors"],
    queryFn: () => apiFetch<SensorStatus[]>("/api/sensors/status"),
    refetchInterval: 5_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Sensor Analytics</h1>
        <p className="text-sm text-slate-400">
          Baggage belts, HVAC, runway friction, fuel pressure, de-icing tanks.
          Anomaly score is computed <span className="text-slate-300">server-side</span> —
          the UI never embeds detection logic. Refreshes every 5s.
        </p>
      </header>

      {isLoading && <div className="text-slate-400">Loading…</div>}
      {isError && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {data.map((s) => (
              <StatusTile key={s.sensor.id} status={s} />
            ))}
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-slate-300">
              Recent readings (last 12 minutes)
            </h2>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {data.map((s) => (
                <Sparkline key={s.sensor.id} status={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatusTile({ status }: { status: SensorStatus }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">{status.sensor.location}</div>
        <span
          className={`h-2 w-2 rounded-full ${STATUS_COLOR[status.status]}`}
          aria-label={status.status}
        />
      </div>
      <div className="mt-1 text-sm font-medium">{status.sensor.name}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums">
          {status.latestValue?.toFixed(2) ?? "—"}
        </span>
        <span className="text-xs text-slate-500">{status.sensor.unit}</span>
      </div>
      <div className={`text-xs uppercase ${STATUS_TEXT[status.status]}`}>
        {status.status} · anomaly{" "}
        <span className="tabular-nums">
          {((status.anomalyScore ?? 0) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function Sparkline({ status }: { status: SensorStatus }) {
  const readings = status.recentReadings;
  if (readings.length === 0) return null;
  const min = Math.min(...readings.map((r) => r.value));
  const max = Math.max(...readings.map((r) => r.value));
  const range = max - min || 1;
  const W = 220;
  const H = 60;
  const pts = readings
    .map((r, i) => {
      const x = (i / (readings.length - 1)) * W;
      const y = H - ((r.value - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">{status.sensor.name}</div>
        <div className="text-xs text-slate-500">
          {min.toFixed(1)} – {max.toFixed(1)} {status.sensor.unit}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-14 w-full"
        preserveAspectRatio="none"
        aria-label={`${status.sensor.name} sparkline`}
      >
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className={STATUS_TEXT[status.status]}
        />
        {readings.map((r, i) => {
          if (r.anomalyScore < 0.55) return null;
          const x = (i / (readings.length - 1)) * W;
          const y = H - ((r.value - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r={2.5} className="fill-red-400" />;
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>{anomaliesCount(readings)} anomalies / {readings.length} pts</span>
        <span>{new Date(readings[readings.length - 1]!.timestamp).toLocaleTimeString("en-CA")}</span>
      </div>
    </div>
  );
}

const anomaliesCount = (readings: SensorReading[]): number =>
  readings.filter((r) => r.anomalyScore >= 0.55).length;
