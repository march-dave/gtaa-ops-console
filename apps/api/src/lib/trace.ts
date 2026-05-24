import { randomUUID } from "node:crypto";

export const generateTraceId = (): string => randomUUID();
