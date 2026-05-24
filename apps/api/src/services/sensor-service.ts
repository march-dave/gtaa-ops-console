import type {
  Sensor,
  SensorReading,
  SensorStatus,
  SensorStatusKind,
  SensorType,
} from "@gtaa/contracts";

interface SensorBlueprint {
  id: string;
  name: string;
  location: string;
  type: SensorType;
  unit: string;
  baseline: number;
  variance: number;
}

const BLUEPRINTS: SensorBlueprint[] = [
  {
    id: "s-belt-t3-a",
    name: "Baggage belt T3-A",
    location: "T3 BHS Line A",
    type: "baggage_belt_load",
    unit: "kg/min",
    baseline: 240,
    variance: 30,
  },
  {
    id: "s-belt-t1-d",
    name: "Baggage belt T1-D",
    location: "T1 BHS Line D",
    type: "baggage_belt_load",
    unit: "kg/min",
    baseline: 180,
    variance: 25,
  },
  {
    id: "s-hvac-t3",
    name: "HVAC zone T3-N",
    location: "T3 north concourse",
    type: "hvac_temperature",
    unit: "°C",
    baseline: 22,
    variance: 1.5,
  },
  {
    id: "s-runway-06L",
    name: "Runway 06L friction",
    location: "Runway 06L threshold",
    type: "runway_friction",
    unit: "μ",
    baseline: 0.82,
    variance: 0.05,
  },
  {
    id: "s-fuel-apron-b",
    name: "Fuel pressure Apron B",
    location: "Apron B fuel main",
    type: "fuel_pressure",
    unit: "psi",
    baseline: 95,
    variance: 4,
  },
  {
    id: "s-deice-tank-1",
    name: "De-icing tank 1",
    location: "T3 de-ice pad",
    type: "deicing_fluid_level",
    unit: "%",
    baseline: 78,
    variance: 5,
  },
];

const sensors: Sensor[] = BLUEPRINTS.map(({ id, name, location, type, unit }) => ({
  id,
  name,
  location,
  type,
  unit,
}));

export function listSensors(): Sensor[] {
  return sensors;
}

/** Generate a fresh synthetic status snapshot. Deterministic randomness not required for demo. */
export function generateSensorStatuses(): SensorStatus[] {
  return BLUEPRINTS.map((bp) => {
    const readings = synthesizeReadings(bp, 12);
    const latest = readings[readings.length - 1]!;
    return {
      sensor: {
        id: bp.id,
        name: bp.name,
        location: bp.location,
        type: bp.type,
        unit: bp.unit,
      },
      latestValue: latest.value,
      anomalyScore: latest.anomalyScore,
      status: statusFromScore(latest.anomalyScore),
      updatedAt: latest.timestamp,
      recentReadings: readings,
    };
  });
}

function synthesizeReadings(bp: SensorBlueprint, count: number): SensorReading[] {
  const out: SensorReading[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = new Date(now - i * 60_000); // one per minute
    const isAnomaly = Math.random() < (i === 0 ? 0.18 : 0.05);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const factor = isAnomaly
      ? (3 + Math.random() * 1.5) * direction
      : (Math.random() * 2 - 1) * 0.8;
    const value = bp.baseline + bp.variance * factor;
    const score = isAnomaly
      ? Math.min(0.99, 0.55 + Math.abs(factor) * 0.1)
      : Math.min(0.35, Math.abs(factor) * 0.25);
    out.push({
      sensorId: bp.id,
      value: Number(value.toFixed(2)),
      anomalyScore: Number(score.toFixed(2)),
      timestamp: t.toISOString(),
    });
  }
  return out;
}

function statusFromScore(score: number): SensorStatusKind {
  if (score >= 0.7) return "alert";
  if (score >= 0.4) return "warn";
  return "ok";
}
