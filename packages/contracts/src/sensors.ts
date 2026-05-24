import { z } from "zod";
import { IsoDateTime } from "./common.js";

export const SensorType = z.enum([
  "baggage_belt_load",
  "hvac_temperature",
  "runway_friction",
  "fuel_pressure",
  "deicing_fluid_level",
]);
export type SensorType = z.infer<typeof SensorType>;

export const SensorStatusKind = z.enum(["ok", "warn", "alert", "offline"]);
export type SensorStatusKind = z.infer<typeof SensorStatusKind>;

export const Sensor = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  type: SensorType,
  unit: z.string(),
});
export type Sensor = z.infer<typeof Sensor>;

export const SensorReading = z.object({
  sensorId: z.string(),
  value: z.number(),
  anomalyScore: z.number().min(0).max(1),
  timestamp: IsoDateTime,
});
export type SensorReading = z.infer<typeof SensorReading>;

export const SensorStatus = z.object({
  sensor: Sensor,
  latestValue: z.number().nullable(),
  anomalyScore: z.number().min(0).max(1).nullable(),
  status: SensorStatusKind,
  updatedAt: IsoDateTime.nullable(),
  recentReadings: z.array(SensorReading),
});
export type SensorStatus = z.infer<typeof SensorStatus>;
