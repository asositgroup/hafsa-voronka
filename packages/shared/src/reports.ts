import { z } from "zod";
import { funnelSegments } from "./funnel";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ATTRIBUTION_WINDOW_HOURS = 48;

export const adminReportQuerySchema = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;

export const videoReportRowSchema = z.object({
  videoId: z.number(),
  title: z.string(),
  isActive: z.boolean(),
  archived: z.boolean(),
  given: z.number(),
  opened: z.number(),
  leftEarly: z.number(),
  reachedCourse: z.number().nullable(),
  reachedPrice: z.number().nullable(),
  offerWatched: z.number().nullable(),
  wroteAdmin: z.number(),
});

export type VideoReportRow = z.infer<typeof videoReportRowSchema>;

export const messageReportRowSchema = z.object({
  templateId: z.number(),
  segment: z.enum(funnelSegments),
  day: z.number(),
  position: z.number(),
  preview: z.string(),
  deleted: z.boolean(),
  sent: z.number(),
  clicked: z.number(),
  priceAfter: z.number().nullable(),
  clickedPriceAfter: z.number().nullable(),
  adminAfter: z.number(),
  clickedAdminAfter: z.number(),
});

export type MessageReportRow = z.infer<typeof messageReportRowSchema>;

export const secondChanceReportSchema = z.object({
  offered: z.number(),
  again: z.number(),
  later: z.number(),
  reopened: z.number(),
  reachedPrice: z.number(),
});

export type SecondChanceReport = z.infer<typeof secondChanceReportSchema>;

export const adminReportResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  videos: z.array(videoReportRowSchema),
  messages: z.array(messageReportRowSchema),
  secondChance: secondChanceReportSchema,
});

export type AdminReportResponse = z.infer<typeof adminReportResponseSchema>;

export function reportPercent(count: number | null, base: number): number | null {
  if (count === null) return null;
  if (base === 0) return 0;
  return Math.round((count / base) * 1000) / 10;
}
