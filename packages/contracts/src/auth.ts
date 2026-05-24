import { z } from "zod";
import { IsoDateTime, Role } from "./common.js";

export const User = z.object({
  id: z.string(),
  oid: z.string().describe("Entra ID object identifier (oid claim)"),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(Role).min(1),
});
export type User = z.infer<typeof User>;

export const Session = z.object({
  user: User,
  expiresAt: IsoDateTime,
});
export type Session = z.infer<typeof Session>;
