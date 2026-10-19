import { z } from "zod";
import { funnelSegments } from "./funnel";
import { formatMmSs } from "./time";

export const templateVariables = ["ism", "qolgan_vaqt", "toxtagan_joy", "qolgan_daqiqa", "link_tugash_vaqti"] as const;

export type TemplateVariable = (typeof templateVariables)[number];

export const TEMPLATE_VARIABLE_MAX_LENGTH: Record<TemplateVariable, number> = {
  ism: 64,
  qolgan_vaqt: 24,
  toxtagan_joy: 8,
  qolgan_daqiqa: 4,
  link_tugash_vaqti: 20,
};

export const TEMPLATE_TEXT_LIMITS = {
  message: 4096,
  caption: 1024,
} as const;

export const TEMPLATE_DAYS = 7;
export const MINUTES_PER_DAY = 1440;
export const NIGHT = { start: 1380, end: 420 } as const;
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type TemplateContext = {
  name: string | null;
  firstName: string | null;
  lastPositionSec: number;
  durationSec: number | null;
  linkExpiresAt: Date | null;
  now: Date;
};

export const SAMPLE_CONTEXT: TemplateContext = {
  name: "Aziza",
  firstName: "Aziza",
  lastPositionSec: 754,
  durationSec: 1050,
  linkExpiresAt: new Date("2026-10-21T13:30:00Z"),
  now: new Date("2026-10-19T08:10:00Z"),
};

const uzbekMonths = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const DEFAULT_NAME = "Foydalanuvchi";

function remainingTime(now: Date, expiresAt: Date | null): string {
  if (!expiresAt) return "0 daqiqa";
  const totalMinutes = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
  if (totalMinutes <= 0) return "0 daqiqa";
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} kun ${hours} soat` : `${days} kun`;
  if (hours > 0) return minutes > 0 ? `${hours} soat ${minutes} daqiqa` : `${hours} soat`;
  return `${minutes} daqiqa`;
}

function playbackPosition(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  if (total < 3600) return formatMmSs(total);
  const hours = Math.floor(total / 3600);
  const rest = total % 3600;
  return `${hours}:${formatMmSs(rest)}`;
}

function tashkentDateTime(date: Date): string {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${local.getUTCDate()}-${uzbekMonths[local.getUTCMonth()]}, ${hh}:${mm}`;
}

export function variableValues(ctx: TemplateContext): Record<TemplateVariable, string> {
  const name = ctx.name?.trim() || ctx.firstName?.trim() || DEFAULT_NAME;
  return {
    ism: name.slice(0, TEMPLATE_VARIABLE_MAX_LENGTH.ism),
    qolgan_vaqt: remainingTime(ctx.now, ctx.linkExpiresAt),
    toxtagan_joy: playbackPosition(ctx.lastPositionSec),
    qolgan_daqiqa:
      ctx.durationSec === null ? "" : String(Math.max(0, Math.ceil((ctx.durationSec - ctx.lastPositionSec) / 60))),
    link_tugash_vaqti: ctx.linkExpiresAt ? tashkentDateTime(ctx.linkExpiresAt) : "",
  };
}

export type HtmlToken =
  | { kind: "text"; text: string }
  | { kind: "open"; tag: "b" | "i" | "a"; href?: string }
  | { kind: "close"; tag: "b" | "i" | "a" };

export type SanitizeResult =
  | { ok: true; html: string; tokens: HtmlToken[] }
  | { ok: false; error: "unbalanced_tag" | "invalid_link" };

const ENTITY_PATTERN = /&(amp|lt|gt|quot);/g;
const ENTITY_VALUES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' };
const TAG_PATTERN = /^<(\/?)([bi])>|^<\/(a)>|^<a\s+href\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>/;
const LINK_PATTERN = /^(?:https?:\/\/|tg:\/\/)[^\s<>"{]+$/;

function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (_, name: string) => ENTITY_VALUES[name]);
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function serialize(tokens: HtmlToken[]): string {
  return tokens
    .map((token) => {
      if (token.kind === "text") return escapeHtml(token.text);
      if (token.kind === "close") return `</${token.tag}>`;
      return token.tag === "a" ? `<a href="${escapeAttribute(token.href ?? "")}">` : `<${token.tag}>`;
    })
    .join("");
}

export function sanitizeTelegramHtml(input: string): SanitizeResult {
  const tokens: HtmlToken[] = [];
  const stack: string[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) tokens.push({ kind: "text", text: decodeEntities(buffer) });
    buffer = "";
  };

  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === "<") {
      const match = TAG_PATTERN.exec(input.slice(index));
      if (match) {
        flush();
        index += match[0].length;
        if (match[3]) {
          if (stack.pop() !== "a") return { ok: false, error: "unbalanced_tag" };
          tokens.push({ kind: "close", tag: "a" });
        } else if (match[2]) {
          const tag = match[2] as "b" | "i";
          if (match[1]) {
            if (stack.pop() !== tag) return { ok: false, error: "unbalanced_tag" };
            tokens.push({ kind: "close", tag });
          } else {
            stack.push(tag);
            tokens.push({ kind: "open", tag });
          }
        } else {
          const href = decodeEntities(match[4] ?? match[5] ?? "");
          if (!LINK_PATTERN.test(href)) return { ok: false, error: "invalid_link" };
          stack.push("a");
          tokens.push({ kind: "open", tag: "a", href });
        }
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
  if (stack.length > 0) return { ok: false, error: "unbalanced_tag" };
  return { ok: true, html: serialize(tokens), tokens };
}

export function renderText(html: string, values: Record<string, string>): string {
  return html.replace(/\{([A-Za-z_]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? escapeHtml(values[name]) : match,
  );
}

export function renderPlainText(text: string, values: Record<string, string>): string {
  return text.replace(/\{([A-Za-z_]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? values[name] : match,
  );
}

export function visibleLength(html: string): number {
  const withoutTags = html.replace(/<[^>]*>/g, "");
  const withVariables = decodeEntities(withoutTags).replace(/\{([A-Za-z_]+)\}/g, (match, name: string) =>
    Object.hasOwn(TEMPLATE_VARIABLE_MAX_LENGTH, name)
      ? "x".repeat(TEMPLATE_VARIABLE_MAX_LENGTH[name as TemplateVariable])
      : match,
  );
  return withVariables.length;
}

export function templateTextLimit(hasMedia: boolean): number {
  return hasMedia ? TEMPLATE_TEXT_LIMITS.caption : TEMPLATE_TEXT_LIMITS.message;
}

export type TemplateTextError = {
  error: "empty" | "too_long" | "unbalanced_tag" | "invalid_link" | "unknown_variable";
  variable?: string;
};

export function validateTemplateText(text: string, hasMedia: boolean): TemplateTextError | null {
  if (!text.trim()) return { error: "empty" };
  for (const match of text.matchAll(/\{([A-Za-z_]+)\}/g)) {
    if (!(templateVariables as readonly string[]).includes(match[1])) {
      return { error: "unknown_variable", variable: match[1] };
    }
  }
  const sanitized = sanitizeTelegramHtml(text);
  if (!sanitized.ok) return { error: sanitized.error };
  if (visibleLength(sanitized.html) > templateTextLimit(hasMedia)) return { error: "too_long" };
  return null;
}

export const timingTypes = ["after_entry", "day_time", "before_expiry"] as const;

export type TimingType = (typeof timingTypes)[number];

export type TemplateTiming = { type: TimingType; value: number };

export type TimingError = "out_of_range" | "outside_day" | "night";

export function isNightMinute(minuteOfDay: number): boolean {
  return minuteOfDay < NIGHT.end || minuteOfDay >= NIGHT.start;
}

export function validateTiming(day: number, timing: TemplateTiming): TimingError | null {
  const { type, value } = timing;
  if (!Number.isInteger(value)) return "out_of_range";
  if (type === "after_entry") {
    if (value < 0 || value >= TEMPLATE_DAYS * MINUTES_PER_DAY) return "out_of_range";
    const start = (day - 1) * MINUTES_PER_DAY;
    return value >= start && value < start + MINUTES_PER_DAY ? null : "outside_day";
  }
  if (type === "day_time") {
    if (value < 0 || value >= MINUTES_PER_DAY) return "out_of_range";
    return isNightMinute(value) ? "night" : null;
  }
  return value >= 1 && value <= TEMPLATE_DAYS * MINUTES_PER_DAY ? null : "out_of_range";
}

export const templateMediaTypes = ["photo", "video", "voice"] as const;

export type TemplateMediaType = (typeof templateMediaTypes)[number];

export const TEMPLATE_MEDIA_MIME_TYPES: Record<TemplateMediaType, readonly string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4"],
  voice: ["audio/ogg", "audio/mpeg", "audio/mp4"],
};

export const TEMPLATE_MEDIA_LIMITS: Record<TemplateMediaType, number> = {
  photo: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  voice: 20 * 1024 * 1024,
};

export function templateMediaTypeFor(mimeType: string): TemplateMediaType | null {
  for (const type of templateMediaTypes) {
    if (TEMPLATE_MEDIA_MIME_TYPES[type].includes(mimeType)) return type;
  }
  return null;
}

export const MAX_TEMPLATE_BUTTONS = 3;

export const buttonPresets = {
  resume: "Ha, ko'raman",
  when_menu: "Qachon ko'rasiz?",
  later: "Keyinroq",
} as const;

const buttonText = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !/[\r\n{]/.test(value));

const httpsUrl = z
  .url()
  .max(512)
  .refine((value) => value.startsWith("https://"));

export const templateButtonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resume"), text: buttonText }),
  z.object({ kind: z.literal("offer"), text: buttonText }),
  z.object({ kind: z.literal("admin"), text: buttonText, prefill: z.string().max(200).optional() }),
  z.object({ kind: z.literal("when_menu"), text: buttonText }),
  z.object({ kind: z.literal("later"), text: buttonText }),
  z.object({ kind: z.literal("link"), text: buttonText, url: httpsUrl }),
]);

export type TemplateButton = z.infer<typeof templateButtonSchema>;

export type TemplateButtonKind = TemplateButton["kind"];

export const templateButtonKinds = ["resume", "offer", "admin", "when_menu", "later", "link"] as const;

export const templateMediaSchema = z.object({
  type: z.enum(templateMediaTypes),
  fileId: z.string().min(1).max(256),
});

export type TemplateMedia = z.infer<typeof templateMediaSchema>;

export const templateTimingSchema = z.object({
  type: z.enum(timingTypes),
  value: z.number().int(),
});

export const messageTemplateBaseSchema = z.object({
  segment: z.enum(funnelSegments),
  day: z.number().int().min(1).max(TEMPLATE_DAYS),
  text: z.string().max(TEMPLATE_TEXT_LIMITS.message * 3),
  media: templateMediaSchema.nullable(),
  timing: templateTimingSchema,
  buttons: z.array(templateButtonSchema).max(MAX_TEMPLATE_BUTTONS),
  isActive: z.boolean(),
});

export type MessageTemplateInput = z.infer<typeof messageTemplateBaseSchema>;

export type TemplateValidationIssue =
  | { path: "text"; error: TemplateTextError["error"]; variable?: string }
  | { path: "timing"; error: TimingError };

export function validateTemplateInput(input: MessageTemplateInput): TemplateValidationIssue | null {
  const textError = validateTemplateText(input.text, input.media !== null);
  if (textError) return { path: "text", ...textError };
  const timingError = validateTiming(input.day, input.timing);
  if (timingError) return { path: "timing", error: timingError };
  return null;
}

export const messageTemplateInputSchema = messageTemplateBaseSchema.superRefine((input, ctx) => {
  const issue = validateTemplateInput(input);
  if (!issue) return;
  ctx.addIssue({
    code: "custom",
    message: issue.error,
    path: issue.path === "text" ? ["text"] : ["timing", "value"],
  });
});

export const messageTemplateSchema = messageTemplateBaseSchema.extend({
  id: z.number().int(),
  position: z.number().int(),
  updatedAt: z.string(),
});

export type MessageTemplate = z.infer<typeof messageTemplateSchema>;

export const messageTemplatesResponseSchema = z.object({
  items: z.array(messageTemplateSchema),
  admins: z.array(z.object({ telegramId: z.number().int(), label: z.string() })),
  mediaEnabled: z.boolean(),
  prefillSupported: z.boolean(),
});

export type MessageTemplatesResponse = z.infer<typeof messageTemplatesResponseSchema>;

export const reorderSchema = z.object({
  segment: z.enum(funnelSegments),
  day: z.number().int().min(1).max(TEMPLATE_DAYS),
  ids: z.array(z.number().int().positive()).max(200),
});

export type ReorderRequest = z.infer<typeof reorderSchema>;

export const activeSchema = z.object({ isActive: z.boolean() });

export const testSendSchema = z.object({
  draft: messageTemplateBaseSchema,
  adminTelegramId: z.number().int(),
  templateId: z.number().int().positive().optional(),
});

export type TestSendRequest = z.infer<typeof testSendSchema>;

export const templateMediaUploadSchema = z.object({
  type: z.enum(templateMediaTypes),
  fileId: z.string().min(1),
});
