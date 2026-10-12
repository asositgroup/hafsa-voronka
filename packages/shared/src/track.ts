import { z } from "zod";

export const trackTypeSchema = z.enum(["landing_view", "cta_click"]);
export type TrackType = z.infer<typeof trackTypeSchema>;

export const trackRequestSchema = z.object({
  visitor_id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  type: trackTypeSchema,
  utm_source: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  fbclid: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
});

export type TrackRequest = z.infer<typeof trackRequestSchema>;
