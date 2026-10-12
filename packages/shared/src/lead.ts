import { z } from "zod";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "./schemas";

export const leadRequestSchema = z.object({
  visitor_id: z.string().regex(/^[A-Za-z0-9_-]{10}$/),
  name: z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH),
  phone: z.string().max(40),
  website: z.string().max(200).optional(),
  utm_source: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  fbclid: z.string().max(500).optional(),
  page_url: z.string().max(500).optional(),
});

export type LeadRequest = z.infer<typeof leadRequestSchema>;

export const leadResponseSchema = z.object({
  ok: z.literal(true),
  event_id: z.string(),
});

export type LeadResponse = z.infer<typeof leadResponseSchema>;

export const leadErrorSchema = z.object({
  field: z.enum(["name", "phone"]),
  message: z.string(),
});

export type LeadError = z.infer<typeof leadErrorSchema>;
