import { z } from "zod";

export const LINK_TTL_HOURS_MIN = 1;
export const LINK_TTL_HOURS_MAX = 720;

export const adminSettingsSchema = z.object({
  linkTtlHours: z.number().int().min(LINK_TTL_HOURS_MIN).max(LINK_TTL_HOURS_MAX),
});

export const adminSettingsUpdateSchema = adminSettingsSchema;

export type AdminSettings = z.infer<typeof adminSettingsSchema>;
