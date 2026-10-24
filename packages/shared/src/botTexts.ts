import { z } from "zod";
import { type SanitizeError, sanitizeTelegramHtml, visibleLength } from "./messages";

export const BOT_TEXT_LIMITS = {
  message: 4096,
  caption: 1024,
  button: 64,
} as const;

export const BOT_MEDIA_LIMITS = {
  photo: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const;

export const BOT_MEDIA_MIME_TYPES = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4"],
} as const;

export const botMessageKeys = [
  "welcome",
  "welcomeBack",
  "watchPrompt",
  "completion",
  "fallback",
  "laterAck",
  "laterAsk",
  "laterPickDay",
  "laterPickHour",
  "laterConfirmed",
  "laterTooLate",
  "reopenPreReminder",
  "reopenNow",
  "remindNow",
  "offerClosed",
  "rolloutPrompt",
] as const;

export const botButtonKeys = [
  "watchButton",
  "channelButton",
  "laterTonight",
  "laterTomorrowMorning",
  "laterTomorrowEvening",
  "laterOther",
  "dayToday",
  "dayTomorrow",
  "dayAfterTomorrow",
  "reopenWatchButton",
  "remindWatchButton",
] as const;

export const botTextKeys = [...botMessageKeys, ...botButtonKeys] as const;

export type BotMessageKey = (typeof botMessageKeys)[number];
export type BotButtonKey = (typeof botButtonKeys)[number];
export type BotTextKey = BotMessageKey | BotButtonKey;

export type BotTextKind = "message" | "button";

export type BotMediaType = keyof typeof BOT_MEDIA_LIMITS;

export const botTextDefinitions: Record<BotTextKey, { kind: BotTextKind; placeholders: readonly string[] }> = {
  welcome: { kind: "message", placeholders: ["name"] },
  welcomeBack: { kind: "message", placeholders: ["name"] },
  watchPrompt: { kind: "message", placeholders: ["name"] },
  completion: { kind: "message", placeholders: [] },
  fallback: { kind: "message", placeholders: [] },
  laterAck: { kind: "message", placeholders: [] },
  laterAsk: { kind: "message", placeholders: [] },
  laterPickDay: { kind: "message", placeholders: [] },
  laterPickHour: { kind: "message", placeholders: [] },
  laterConfirmed: { kind: "message", placeholders: ["vaqt"] },
  laterTooLate: { kind: "message", placeholders: ["link_tugash_vaqti"] },
  reopenPreReminder: { kind: "message", placeholders: [] },
  reopenNow: { kind: "message", placeholders: [] },
  remindNow: { kind: "message", placeholders: [] },
  offerClosed: { kind: "message", placeholders: [] },
  rolloutPrompt: { kind: "message", placeholders: ["name"] },
  watchButton: { kind: "button", placeholders: [] },
  channelButton: { kind: "button", placeholders: [] },
  laterTonight: { kind: "button", placeholders: ["soat"] },
  laterTomorrowMorning: { kind: "button", placeholders: ["soat"] },
  laterTomorrowEvening: { kind: "button", placeholders: ["soat"] },
  laterOther: { kind: "button", placeholders: [] },
  dayToday: { kind: "button", placeholders: [] },
  dayTomorrow: { kind: "button", placeholders: [] },
  dayAfterTomorrow: { kind: "button", placeholders: [] },
  reopenWatchButton: { kind: "button", placeholders: [] },
  remindWatchButton: { kind: "button", placeholders: [] },
};

export const BOT_PLACEHOLDER_MAX_LENGTH = 64;

export type BotTextError = "empty" | "too_long" | "unknown_placeholder" | "multiline_button" | SanitizeError;

export function botTextLimit(key: BotTextKey, hasMedia: boolean): number {
  if (botTextDefinitions[key].kind === "button") return BOT_TEXT_LIMITS.button;
  return hasMedia ? BOT_TEXT_LIMITS.caption : BOT_TEXT_LIMITS.message;
}

export function botVisibleLength(text: string): number {
  const sanitized = sanitizeTelegramHtml(text);
  const html = sanitized.ok ? sanitized.html : text;
  return visibleLength(html.replace(/\{\w+\}/g, "x".repeat(BOT_PLACEHOLDER_MAX_LENGTH)));
}

export function validateBotText(key: BotTextKey, text: string, hasMedia: boolean): BotTextError | null {
  const { kind, placeholders } = botTextDefinitions[key];
  if (!text.trim()) return "empty";
  if (kind === "button" && /\n/.test(text)) return "multiline_button";
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  if (used.some((name) => !placeholders.includes(name))) return "unknown_placeholder";
  if (kind === "button") return text.replace(/\{\w+\}/g, "").length > botTextLimit(key, hasMedia) ? "too_long" : null;
  const sanitized = sanitizeTelegramHtml(text);
  if (!sanitized.ok) return sanitized.error;
  if (botVisibleLength(text) > botTextLimit(key, hasMedia)) return "too_long";
  return null;
}

export function botMediaTypeFor(mimeType: string): BotMediaType | null {
  for (const type of Object.keys(BOT_MEDIA_MIME_TYPES) as BotMediaType[]) {
    if ((BOT_MEDIA_MIME_TYPES[type] as readonly string[]).includes(mimeType)) return type;
  }
  return null;
}

export const botTextKeySchema = z.enum(botTextKeys);

export const botTextItemSchema = z.object({
  key: botTextKeySchema,
  kind: z.enum(["message", "button"]),
  placeholders: z.array(z.string()),
  defaultText: z.string(),
  text: z.string().nullable(),
  media: z.object({ type: z.enum(["photo", "video"]) }).nullable(),
  updatedAt: z.string().nullable(),
});

export type BotTextItem = z.infer<typeof botTextItemSchema>;

export const botTextsResponseSchema = z.object({
  items: z.array(botTextItemSchema),
  mediaEnabled: z.boolean(),
});

export type BotTextsResponse = z.infer<typeof botTextsResponseSchema>;

export const botTextUpdateSchema = z.object({
  text: z.string().max(BOT_TEXT_LIMITS.message * 2),
});

export type BotTextUpdate = z.infer<typeof botTextUpdateSchema>;
