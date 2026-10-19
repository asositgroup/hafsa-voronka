import {
  EXTENDED_EXPIRY_MINUTE,
  type FunnelSegment,
  isNightMinute,
  linkBoundSegments,
  MORNING_SEND_MINUTE,
  NIGHT,
  NIGHT_NOTICE_MINUTE,
  TASHKENT_OFFSET_MS,
  TEMPLATE_DAYS,
  type TimingType,
} from "@funnel/shared";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 86_400_000;
export const CHAIN_MS = TEMPLATE_DAYS * DAY_MS;
export const GRACE_MS = 60 * MINUTE_MS;
export const DAILY_CAP = 10;
const COLLAPSE_SPACING_MS = 60 * MINUTE_MS;

export type ScheduleTemplate = {
  id: number;
  day: number;
  position: number;
  timingType: TimingType;
  timingValue: number;
};

export type PlanKind = "regular" | "collapsed" | "night_notice";

export type PlanItem<T extends ScheduleTemplate = ScheduleTemplate> = {
  template: T;
  sendAt: Date;
  slot: string;
  kind: PlanKind;
};

export type SkippedItem<T extends ScheduleTemplate = ScheduleTemplate> = {
  template: T;
  rawAt: Date;
  reason: "swallowed" | "dropped";
};

export type PlanInput<T extends ScheduleTemplate = ScheduleTemplate> = {
  templates: T[];
  anchorAt: Date;
  linkExpiresAt: Date | null;
  linkBound: boolean;
  nightNotice: T | null;
};

type Raw<T extends ScheduleTemplate> = { template: T; rawAt: Date };

export function tashkentDayStart(date: Date): Date {
  const local = date.getTime() + TASHKENT_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS);
}

export function tashkentMinuteOfDay(date: Date): number {
  const local = date.getTime() + TASHKENT_OFFSET_MS;
  return Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / MINUTE_MS);
}

export function isNightAt(date: Date): boolean {
  return isNightMinute(tashkentMinuteOfDay(date));
}

function nightMorningOf(date: Date): number | null {
  const minute = tashkentMinuteOfDay(date);
  if (minute >= NIGHT.start) return tashkentDayStart(date).getTime() + DAY_MS;
  if (minute < NIGHT.end) return tashkentDayStart(date).getTime();
  return null;
}

function tashkentDate(dayStart: number): string {
  return new Date(dayStart + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export function linkExpiryFor(givenAt: Date, ttlHours: number): Date {
  const raw = new Date(givenAt.getTime() + ttlHours * HOUR_MS);
  const morning = nightMorningOf(raw);
  return morning === null ? raw : new Date(morning + EXTENDED_EXPIRY_MINUTE * MINUTE_MS);
}

function rawTime(template: ScheduleTemplate, input: PlanInput): Date | null {
  const anchor = input.anchorAt.getTime();
  const value = template.timingValue * MINUTE_MS;
  let raw: number;
  if (template.timingType === "after_entry") {
    raw = anchor + value;
  } else if (template.timingType === "day_time") {
    raw = tashkentDayStart(input.anchorAt).getTime() + (template.day - 1) * DAY_MS + value;
  } else if (template.timingType === "before_expiry" && input.linkExpiresAt !== null) {
    raw = input.linkExpiresAt.getTime() - value;
  } else {
    return null;
  }
  if (raw < anchor || raw >= anchor + CHAIN_MS) return null;
  if (input.linkBound && input.linkExpiresAt !== null && raw >= input.linkExpiresAt.getTime()) return null;
  return new Date(raw);
}

function compareRaw<T extends ScheduleTemplate>(a: Raw<T>, b: Raw<T>): number {
  return (
    a.rawAt.getTime() - b.rawAt.getTime() ||
    a.template.day - b.template.day ||
    a.template.position - b.template.position ||
    a.template.id - b.template.id
  );
}

function compareItems<T extends ScheduleTemplate>(a: PlanItem<T>, b: PlanItem<T>): number {
  return compareRaw({ template: a.template, rawAt: a.sendAt }, { template: b.template, rawAt: b.sendAt });
}

export function previewChain<T extends ScheduleTemplate>(
  input: PlanInput<T>,
): { items: PlanItem<T>[]; skipped: SkippedItem<T>[] } {
  const anchorMorning = nightMorningOf(input.anchorAt);
  const swallowedBy = (at: Date): number | null => {
    const morning = nightMorningOf(at);
    if (morning !== null) return morning;
    const sameMorning = anchorMorning !== null && tashkentDayStart(at).getTime() === anchorMorning;
    return sameMorning && tashkentMinuteOfDay(at) < MORNING_SEND_MINUTE ? anchorMorning : null;
  };

  const raws: Raw<T>[] = [];
  for (const template of input.templates) {
    const rawAt = rawTime(template, input);
    if (rawAt) raws.push({ template, rawAt });
  }
  raws.sort(compareRaw);

  const items: PlanItem<T>[] = [];
  const nights = new Map<number, Raw<T>[]>();
  for (const raw of raws) {
    const morning = swallowedBy(raw.rawAt);
    if (morning === null) items.push({ template: raw.template, sendAt: raw.rawAt, slot: "", kind: "regular" });
    else nights.set(morning, [...(nights.get(morning) ?? []), raw]);
  }

  const dayTimes = items.map((item) => item.sendAt.getTime());
  const expiry = input.linkBound ? input.linkExpiresAt : null;
  const skipped: SkippedItem<T>[] = [];
  const extra: PlanItem<T>[] = [];

  for (const [morning, swallowed] of nights) {
    const candidate = swallowed[swallowed.length - 1];
    const sendAt = morning + MORNING_SEND_MINUTE * MINUTE_MS;
    const afterExpiry = expiry !== null && sendAt >= expiry.getTime();
    const crowded = dayTimes.some((time) => Math.abs(time - sendAt) < COLLAPSE_SPACING_MS);
    const kept = !afterExpiry && !crowded;
    for (const raw of swallowed) {
      if (raw === candidate && kept) continue;
      skipped.push({ template: raw.template, rawAt: raw.rawAt, reason: raw === candidate ? "dropped" : "swallowed" });
    }
    if (kept) extra.push({ template: candidate.template, sendAt: new Date(sendAt), slot: "", kind: "collapsed" });

    const noticeAt = morning - DAY_MS + NIGHT_NOTICE_MINUTE * MINUTE_MS;
    if (
      swallowed.length >= 2 &&
      expiry !== null &&
      input.nightNotice !== null &&
      tashkentDayStart(expiry).getTime() === morning &&
      noticeAt >= input.anchorAt.getTime()
    ) {
      extra.push({ template: input.nightNotice, sendAt: new Date(noticeAt), slot: tashkentDate(morning), kind: "night_notice" });
    }
  }

  return { items: [...items, ...extra].sort(compareItems), skipped: skipped.sort(compareRaw) };
}

export function planChain<T extends ScheduleTemplate>(input: PlanInput<T>): PlanItem<T>[] {
  return previewChain(input).items;
}

export function segmentChainInput<T extends ScheduleTemplate>(
  templates: T[],
  run: { segment: FunnelSegment; anchorAt: Date; linkExpiresAt: Date | null },
): PlanInput<T> {
  return {
    templates: templates.filter((template) => template.timingType !== "night_notice"),
    anchorAt: run.anchorAt,
    linkExpiresAt: run.linkExpiresAt,
    linkBound: linkBoundSegments.includes(run.segment),
    nightNotice: templates.find((template) => template.timingType === "night_notice") ?? null,
  };
}

export function planKey(item: { template: { id: number }; slot: string }): string {
  return `${item.template.id}:${item.slot}`;
}

export function pickNext<T extends ScheduleTemplate>(
  plan: PlanItem<T>[],
  sent: ReadonlySet<string>,
  now: Date,
  sentToday: number,
): PlanItem<T> | null {
  if (sentToday >= DAILY_CAP || isNightAt(now)) return null;
  const nowMs = now.getTime();
  const found = plan.find(
    (item) => !sent.has(planKey(item)) && item.sendAt.getTime() <= nowMs && nowMs - item.sendAt.getTime() <= GRACE_MS,
  );
  return found ?? null;
}

export function nextPendingDue<T extends ScheduleTemplate>(
  plan: PlanItem<T>[],
  sent: ReadonlySet<string>,
  now: Date,
): Date | null {
  const nowMs = now.getTime();
  const found = plan.find((item) => !sent.has(planKey(item)) && nowMs - item.sendAt.getTime() <= GRACE_MS);
  return found?.sendAt ?? null;
}
