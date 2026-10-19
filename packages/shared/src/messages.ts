import { z } from "zod";
import { type FunnelSegment, funnelSegments } from "./funnel";
import { formatMmSs } from "./time";

export const templateVariables = [
  "ism",
  "qolgan_vaqt",
  "toxtagan_joy",
  "qolgan_daqiqa",
  "link_tugash_vaqti",
  "link_tugash_soati",
] as const;

export type TemplateVariable = (typeof templateVariables)[number];

export const TEMPLATE_VARIABLE_MAX_LENGTH: Record<TemplateVariable, number> = {
  ism: 64,
  qolgan_vaqt: 24,
  toxtagan_joy: 8,
  qolgan_daqiqa: 4,
  link_tugash_vaqti: 20,
  link_tugash_soati: 5,
};

export const TEMPLATE_TEXT_LIMITS = {
  message: 4096,
  caption: 1024,
} as const;

export const TEMPLATE_DAYS = 7;
export const MINUTES_PER_DAY = 1440;
export const NIGHT = { start: 1380, end: 420 } as const;
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const NIGHT_NOTICE_MINUTE = 22 * 60;
export const MORNING_SEND_MINUTE = 7 * 60 + 30;
export const EXTENDED_EXPIRY_MINUTE = 9 * 60;
export const linkBoundSegments: readonly FunnelSegment[] = ["A", "B"];

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

function tashkentClock(date: Date): string {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function tashkentDateTime(date: Date): string {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return `${local.getUTCDate()}-${uzbekMonths[local.getUTCMonth()]}, ${tashkentClock(date)}`;
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
    link_tugash_soati: ctx.linkExpiresAt ? tashkentClock(ctx.linkExpiresAt) : "",
  };
}

export type MarkTag = "b" | "i" | "u" | "s" | "tg-spoiler" | "code";

export type HtmlTag = MarkTag | "a" | "pre" | "blockquote";

export type HtmlToken =
  | { kind: "text"; text: string }
  | { kind: "open"; tag: MarkTag }
  | { kind: "open"; tag: "a"; href: string }
  | { kind: "open"; tag: "pre"; language?: string }
  | { kind: "open"; tag: "blockquote"; expandable: boolean }
  | { kind: "close"; tag: HtmlTag };

export type SanitizeError = "unbalanced_tag" | "invalid_link" | "invalid_nesting";

export type SanitizeResult = { ok: true; html: string; tokens: HtmlToken[] } | { ok: false; error: SanitizeError };

export const TELEGRAM_LANGUAGE_PATTERN = /^[\w#+.-]{1,32}$/;

const ENTITY_PATTERN = /&(?:(amp|lt|gt|quot)|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g;
const ENTITY_VALUES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' };
const OPEN_TAG_PATTERN = /^<([a-z][a-z-]*)((?:\s+[a-z-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*>/;
const CLOSE_TAG_PATTERN = /^<\/([a-z][a-z-]*)>/;
const ATTRIBUTE_PATTERN = /\s+([a-z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
const LINK_PATTERN = /^(?:https?:\/\/|tg:\/\/)[^\s<>"{]+$/;

const MARK_ALIASES: Record<string, MarkTag> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
  ins: "u",
  s: "s",
  strike: "s",
  del: "s",
  "tg-spoiler": "tg-spoiler",
};

const CLOSABLE_SOURCES: Record<string, HtmlTag> = {
  ...MARK_ALIASES,
  span: "tg-spoiler",
  code: "code",
  pre: "pre",
  blockquote: "blockquote",
  a: "a",
};

const MARKS_EXCLUDING_CODE: readonly HtmlTag[] = ["b", "i", "u", "s", "tg-spoiler", "a"];

type Frame = { source: string; tag: HtmlTag; folded?: boolean };

type OpenOutcome =
  | { kind: "text" }
  | { kind: "error"; error: SanitizeError }
  | { kind: "open"; token: HtmlToken; language?: string };

function decodeCodePoint(value: number): string | null {
  if (value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) return null;
  return String.fromCodePoint(value);
}

function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, name?: string, decimal?: string, hex?: string) => {
    if (name) return ENTITY_VALUES[name];
    const decoded = decodeCodePoint(decimal !== undefined ? Number.parseInt(decimal, 10) : Number.parseInt(hex ?? "", 16));
    return decoded ?? match;
  });
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

export function isTelegramLink(href: string): boolean {
  return LINK_PATTERN.test(href);
}

function parseAttributes(raw: string): { name: string; value: string | null }[] {
  const attributes: { name: string; value: string | null }[] = [];
  for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) {
    attributes.push({ name: match[1], value: match[2] ?? match[3] ?? null });
  }
  return attributes;
}

function languageFromClass(value: string | null): { language?: string; error?: true } | null {
  if (value === null || !value.startsWith("language-")) return null;
  const language = value.slice("language-".length);
  return TELEGRAM_LANGUAGE_PATTERN.test(language) ? { language } : { error: true };
}

function interpretOpen(name: string, rawAttributes: string): OpenOutcome {
  const attributes = parseAttributes(rawAttributes);
  const mark = MARK_ALIASES[name];
  if (mark) return attributes.length === 0 ? { kind: "open", token: { kind: "open", tag: mark } } : { kind: "text" };
  if (name === "span") {
    const only = attributes.length === 1 ? attributes[0] : null;
    return only && only.name === "class" && only.value === "tg-spoiler"
      ? { kind: "open", token: { kind: "open", tag: "tg-spoiler" } }
      : { kind: "text" };
  }
  if (name === "pre") {
    return attributes.length === 0 ? { kind: "open", token: { kind: "open", tag: "pre" } } : { kind: "text" };
  }
  if (name === "code") {
    if (attributes.length === 0) return { kind: "open", token: { kind: "open", tag: "code" } };
    const only = attributes.length === 1 ? attributes[0] : null;
    const parsed = only && only.name === "class" ? languageFromClass(only.value) : null;
    if (!parsed) return { kind: "text" };
    if (parsed.error) return { kind: "error", error: "invalid_nesting" };
    return { kind: "open", token: { kind: "open", tag: "code" }, language: parsed.language };
  }
  if (name === "blockquote") {
    if (attributes.length === 0) return { kind: "open", token: { kind: "open", tag: "blockquote", expandable: false } };
    const only = attributes.length === 1 ? attributes[0] : null;
    return only && only.name === "expandable" && (only.value === null || only.value === "")
      ? { kind: "open", token: { kind: "open", tag: "blockquote", expandable: true } }
      : { kind: "text" };
  }
  if (name === "a") {
    const only = attributes.length === 1 ? attributes[0] : null;
    if (!only || only.name !== "href" || only.value === null) return { kind: "text" };
    const href = decodeEntities(only.value);
    if (!isTelegramLink(href)) return { kind: "error", error: "invalid_link" };
    return { kind: "open", token: { kind: "open", tag: "a", href } };
  }
  return { kind: "text" };
}

function violatesNesting(stack: Frame[], next: HtmlTag): boolean {
  const inside = (tag: HtmlTag) => stack.some((frame) => frame.tag === tag && !frame.folded);
  if (inside("code") || inside("pre")) return true;
  if ((next === "code" || next === "pre") && stack.some((frame) => MARKS_EXCLUDING_CODE.includes(frame.tag))) return true;
  if (next === "pre" && inside("blockquote")) return true;
  if (next === "a" && inside("a")) return true;
  return next === "blockquote" && (inside("blockquote") || inside("a"));
}

function serialize(tokens: HtmlToken[]): string {
  const languages: (string | undefined)[] = [];
  return tokens
    .map((token) => {
      if (token.kind === "text") return escapeHtml(token.text);
      if (token.kind === "close") {
        if (token.tag !== "pre") return `</${token.tag}>`;
        return languages.pop() ? "</code></pre>" : "</pre>";
      }
      if (token.tag === "a") return `<a href="${escapeAttribute(token.href)}">`;
      if (token.tag === "pre") {
        languages.push(token.language);
        return token.language ? `<pre><code class="language-${token.language}">` : "<pre>";
      }
      if (token.tag === "blockquote") return token.expandable ? "<blockquote expandable>" : "<blockquote>";
      return `<${token.tag}>`;
    })
    .join("");
}

export function sanitizeTelegramHtml(input: string): SanitizeResult {
  const tokens: HtmlToken[] = [];
  const stack: Frame[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) tokens.push({ kind: "text", text: decodeEntities(buffer) });
    buffer = "";
  };

  let index = 0;
  while (index < input.length) {
    if (input[index] === "<") {
      const rest = input.slice(index);
      const closeMatch = CLOSE_TAG_PATTERN.exec(rest);
      const closeTag = closeMatch ? CLOSABLE_SOURCES[closeMatch[1]] : undefined;
      if (closeMatch && closeTag) {
        flush();
        index += closeMatch[0].length;
        const frame = stack.pop();
        if (!frame || frame.source !== closeMatch[1]) return { ok: false, error: "unbalanced_tag" };
        if (!frame.folded) tokens.push({ kind: "close", tag: frame.tag });
        continue;
      }
      const openMatch = closeMatch ? null : OPEN_TAG_PATTERN.exec(rest);
      if (openMatch) {
        const outcome = interpretOpen(openMatch[1], openMatch[2]);
        if (outcome.kind === "error") return { ok: false, error: outcome.error };
        if (outcome.kind === "open") {
          flush();
          index += openMatch[0].length;
          const top = stack[stack.length - 1];
          const last = tokens[tokens.length - 1];
          if (
            outcome.token.kind === "open" &&
            outcome.token.tag === "code" &&
            top?.tag === "pre" &&
            last?.kind === "open" &&
            last.tag === "pre"
          ) {
            last.language = outcome.language;
            stack.push({ source: "code", tag: "code", folded: true });
            continue;
          }
          const tag = (outcome.token as { tag: HtmlTag }).tag;
          if (violatesNesting(stack, tag)) return { ok: false, error: "invalid_nesting" };
          stack.push({ source: openMatch[1], tag });
          tokens.push(outcome.token);
          continue;
        }
      }
    }
    buffer += input[index];
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

export function plainTextPreview(html: string, max = 60): string {
  const text = decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function templateTextLimit(hasMedia: boolean): number {
  return hasMedia ? TEMPLATE_TEXT_LIMITS.caption : TEMPLATE_TEXT_LIMITS.message;
}

export type TemplateTextError = {
  error: "empty" | "too_long" | SanitizeError | "unknown_variable";
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

export const timingTypes = ["after_entry", "day_time", "before_expiry", "night_notice"] as const;

export type TimingType = (typeof timingTypes)[number];

export type TemplateTiming = { type: TimingType; value: number };

export type TimingError = "out_of_range" | "outside_day" | "night" | "linked_only";

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
  if (type === "night_notice") return value === 0 ? null : "out_of_range";
  return value >= 1 && value <= TEMPLATE_DAYS * MINUTES_PER_DAY ? null : "out_of_range";
}

export function dayForTiming(timing: TemplateTiming, fallbackDay: number): number {
  if (timing.type === "after_entry") return Math.floor(timing.value / MINUTES_PER_DAY) + 1;
  if (timing.type === "day_time") return fallbackDay;
  return 1;
}

export function isExpiryTiming(type: TimingType): boolean {
  return type === "before_expiry" || type === "night_notice";
}

export const EXPIRY_TIMELINE_GROUP = "expiry" as const;

export type TimelineGroupKey = number | typeof EXPIRY_TIMELINE_GROUP;

export type TimelineEntry = { day: number; timing: TemplateTiming; position: number; id: number };

export function timelineGroupKey(entry: Pick<TimelineEntry, "day" | "timing">): TimelineGroupKey {
  if (isExpiryTiming(entry.timing.type)) return EXPIRY_TIMELINE_GROUP;
  return dayForTiming(entry.timing, entry.day);
}

export function timelineSortKey(entry: Pick<TimelineEntry, "day" | "timing">): number {
  const { type, value } = entry.timing;
  if (type === "night_notice") return -(TEMPLATE_DAYS * MINUTES_PER_DAY + 1);
  if (type === "before_expiry") return -value;
  if (type === "day_time") return (entry.day - 1) * MINUTES_PER_DAY + value;
  return value;
}

export function compareTimeline(a: TimelineEntry, b: TimelineEntry): number {
  return timelineSortKey(a) - timelineSortKey(b) || a.position - b.position || a.id - b.id;
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
  if (input.timing.type === "night_notice" && !linkBoundSegments.includes(input.segment)) {
    return { path: "timing", error: "linked_only" };
  }
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

export const schedulePreviewRequestSchema = z.object({
  segment: z.enum(funnelSegments),
  linkGivenAt: z.iso.datetime({ offset: true }),
});

export type SchedulePreviewRequest = z.infer<typeof schedulePreviewRequestSchema>;

export const schedulePreviewKinds = ["regular", "collapsed", "night_notice", "swallowed", "dropped"] as const;

export type SchedulePreviewKind = (typeof schedulePreviewKinds)[number];

export const schedulePreviewSchema = z.object({
  linkGivenAt: z.string(),
  linkExpiresAt: z.string(),
  extended: z.boolean(),
  items: z.array(
    z.object({
      templateId: z.number().int(),
      at: z.string(),
      kind: z.enum(schedulePreviewKinds),
      remaining: z.string(),
    }),
  ),
});

export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;
