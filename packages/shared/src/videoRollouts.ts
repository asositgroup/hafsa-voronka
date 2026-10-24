import { z } from "zod";
import { TASHKENT_OFFSET_MS } from "./messages";

export const rolloutAudiences = ["not_opened", "halfway", "saw_price", "wrote_admin", "bought"] as const;

export type RolloutAudience = (typeof rolloutAudiences)[number];

export const DEFAULT_ROLLOUT_AUDIENCES: readonly RolloutAudience[] = ["not_opened", "halfway", "saw_price"];

export const messageOnlyAudiences: readonly RolloutAudience[] = ["wrote_admin", "bought"];

export const ROLLOUT_WINDOW = { start: 7 * 60, end: 22 * 60 } as const;
export const ROLLOUT_SINCE_DAYS_MAX = 3650;

export const rolloutStatuses = ["scheduled", "running", "done", "cancelled"] as const;

export type RolloutStatus = (typeof rolloutStatuses)[number];

function tashkentMinute(date: Date): number {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function isInRolloutWindow(date: Date): boolean {
  const minute = tashkentMinute(date);
  return minute >= ROLLOUT_WINDOW.start && minute <= ROLLOUT_WINDOW.end;
}

export const rolloutFilterSchema = z.object({
  audiences: z
    .array(z.enum(rolloutAudiences))
    .min(1)
    .max(rolloutAudiences.length)
    .refine((list) => new Set(list).size === list.length),
  sinceDays: z.number().int().min(1).max(ROLLOUT_SINCE_DAYS_MAX).nullable(),
});

export type RolloutFilter = z.infer<typeof rolloutFilterSchema>;

export const rolloutCreateSchema = rolloutFilterSchema.extend({
  scheduledAt: z.iso.datetime({ offset: true }).nullable(),
});

export type RolloutCreate = z.infer<typeof rolloutCreateSchema>;

export type RolloutScheduleError = "past" | "outside_window";

export function validateRolloutSchedule(scheduledAt: Date | null, now: Date): RolloutScheduleError | null {
  if (scheduledAt === null) return null;
  if (scheduledAt.getTime() <= now.getTime()) return "past";
  return isInRolloutWindow(scheduledAt) ? null : "outside_window";
}

export const rolloutPreviewResponseSchema = z.object({ count: z.number().int().nonnegative() });

export type RolloutPreviewResponse = z.infer<typeof rolloutPreviewResponseSchema>;

export const rolloutSchema = z.object({
  id: z.number().int(),
  videoId: z.number().int(),
  audiences: z.array(z.enum(rolloutAudiences)),
  sinceDays: z.number().int().nullable(),
  scheduledAt: z.string(),
  status: z.enum(rolloutStatuses),
  previewCount: z.number().int(),
  targetCount: z.number().int().nullable(),
  sentCount: z.number().int(),
  blockedCount: z.number().int(),
  skippedCount: z.number().int(),
  failedCount: z.number().int(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export type VideoRollout = z.infer<typeof rolloutSchema>;

export const rolloutResponseSchema = z.object({ rollout: rolloutSchema });

export const rolloutsResponseSchema = z.object({ items: z.array(rolloutSchema) });
