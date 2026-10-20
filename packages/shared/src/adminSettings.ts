import { z } from "zod";

export const LINK_TTL_HOURS_MIN = 1;
export const LINK_TTL_HOURS_MAX = 720;
export const MESSAGE_DAILY_CEILING = 10;
export const MESSAGE_TOTAL_MAX = 100;

export const segmentCapSchema = z.object({
  daily: z.number().int().min(1).max(MESSAGE_DAILY_CEILING),
  total: z.number().int().min(1).max(MESSAGE_TOTAL_MAX).nullable(),
});

export type SegmentCap = z.infer<typeof segmentCapSchema>;

export const messageCapsSchema = z.object({
  A: segmentCapSchema,
  B: segmentCapSchema,
  C: segmentCapSchema,
});

export type MessageCaps = z.infer<typeof messageCapsSchema>;

export const DEFAULT_MESSAGE_CAPS: MessageCaps = {
  A: { daily: MESSAGE_DAILY_CEILING, total: null },
  B: { daily: 4, total: 7 },
  C: { daily: MESSAGE_DAILY_CEILING, total: null },
};

export const adminSettingsSchema = z.object({
  linkTtlHours: z.number().int().min(LINK_TTL_HOURS_MIN).max(LINK_TTL_HOURS_MAX),
  messageCaps: messageCapsSchema,
});

export const adminSettingsUpdateSchema = adminSettingsSchema
  .partial()
  .refine((value) => value.linkTtlHours !== undefined || value.messageCaps !== undefined);

export type AdminSettings = z.infer<typeof adminSettingsSchema>;

export type AdminSettingsUpdate = z.infer<typeof adminSettingsUpdateSchema>;
