import { z } from "zod";

export const progressEvents = ["play", "tick", "pause", "ended"] as const;
export type ProgressEvent = (typeof progressEvents)[number];

export const progressRequestSchema = z.object({
  position: z.number().min(0),
  event: z.enum(progressEvents),
});

export type ProgressRequest = z.infer<typeof progressRequestSchema>;

export const progressResponseSchema = z.object({
  completed: z.boolean(),
  maxPosition: z.number(),
});

export type ProgressResponse = z.infer<typeof progressResponseSchema>;

export const videoEventTypes = ["video_start", "channel_click"] as const;
export type VideoEventType = (typeof videoEventTypes)[number];

export const videoEventRequestSchema = z.object({
  type: z.enum(videoEventTypes),
});

export type VideoEventRequest = z.infer<typeof videoEventRequestSchema>;
