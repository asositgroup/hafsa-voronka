import { z } from "zod";

export const sessionRequestSchema = z.object({
  reason: z.enum(["open", "poll"]).default("open"),
});

export type SessionRequest = z.input<typeof sessionRequestSchema>;

export const sessionResponseSchema = z.object({
  registered: z.boolean(),
  name: z.string().nullable(),
  phoneSet: z.boolean(),
  completed: z.boolean(),
  progress: z.object({
    lastPosition: z.number(),
    maxPosition: z.number(),
    remainingSecs: z.number(),
  }),
  config: z.object({
    videoUrl: z.string(),
    poster: z.string(),
    duration: z.number(),
    seekLock: z.boolean(),
    gateProceed: z.boolean(),
    channelUrl: z.string(),
  }),
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
