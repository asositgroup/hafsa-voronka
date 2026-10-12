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

export const registerRequestSchema = z.object({
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  phone: z.string().optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const registerResponseSchema = z.object({
  ok: z.literal(true),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const registerErrorSchema = z.object({
  field: z.enum(["name", "phone"]),
  message: z.string(),
});

export type RegisterError = z.infer<typeof registerErrorSchema>;
