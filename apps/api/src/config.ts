import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().default(8080),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("debug"),

  WEB_ORIGIN: z.string().default("http://localhost:5173"),

  AUTH_MODE: z.enum(["mock", "entra"]).default("mock"),
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_AUDIENCE: z.string().optional(),

  POWERBI_WORKSPACE_ID: z.string().optional(),
  POWERBI_REPORT_ID: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`
    );
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  if (parsed.data.AUTH_MODE === "entra") {
    if (!parsed.data.ENTRA_TENANT_ID || !parsed.data.ENTRA_AUDIENCE) {
      throw new Error(
        "AUTH_MODE=entra requires ENTRA_TENANT_ID and ENTRA_AUDIENCE"
      );
    }
  }
  return parsed.data;
}
