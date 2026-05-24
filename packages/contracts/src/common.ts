import { z } from "zod";

export const Role = z.enum(["Viewer", "DutyManager", "OpsManager"]);
export type Role = z.infer<typeof Role>;

export const ROLE_RANK: Record<Role, number> = {
  Viewer: 0,
  DutyManager: 1,
  OpsManager: 2,
};

export const hasRoleAtLeast = (held: Role[], required: Role): boolean =>
  held.some((r) => ROLE_RANK[r] >= ROLE_RANK[required]);

export const IsoDateTime = z.string().datetime({ offset: true });

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  traceId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
