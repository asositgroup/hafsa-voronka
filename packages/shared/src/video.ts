import { z } from "zod";

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
export const MAX_PLAYBACK_RATE = 2;

export const progressEvents = ["play", "tick", "pause", "ended"] as const;
export type ProgressEvent = (typeof progressEvents)[number];

export const progressRequestSchema = z.object({
  position: z.number().min(0),
  event: z.enum(progressEvents),
});

export type ProgressRequest = z.infer<typeof progressRequestSchema>;

export const progressResponseSchema = z.object({
  completed: z.boolean(),
  unlocked: z.boolean(),
  maxPosition: z.number(),
  remainingSecs: z.number(),
});

export type ProgressResponse = z.infer<typeof progressResponseSchema>;

export const offerProgressResponseSchema = z.object({ completed: z.boolean() });

export type OfferProgressResponse = z.infer<typeof offerProgressResponseSchema>;

export const videoEventTypes = ["video_start", "channel_click"] as const;
export type VideoEventType = (typeof videoEventTypes)[number];

export const videoEventRequestSchema = z.object({
  type: z.enum(videoEventTypes),
});

export type VideoEventRequest = z.infer<typeof videoEventRequestSchema>;
