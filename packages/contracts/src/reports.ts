import { z } from "zod";
import { IsoDateTime } from "./common.js";

export const EmbedTokenRequest = z.object({
  reportId: z.string().min(1),
});
export type EmbedTokenRequest = z.infer<typeof EmbedTokenRequest>;

export const EmbedToken = z.object({
  reportId: z.string(),
  embedUrl: z.string().url(),
  token: z.string(),
  expiresAt: IsoDateTime,
});
export type EmbedToken = z.infer<typeof EmbedToken>;
