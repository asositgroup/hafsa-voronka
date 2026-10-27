import {
  EXTENDED_EXPIRY_MINUTE,
  type FunnelSegment,
  type FunnelStatus,
  isNightMinute,
  linkBoundSegments,
  MESSAGE_DAILY_CEILING,
  MINUTES_PER_DAY,
  NIGHT,
  type SegmentCap,
  TASHKENT_OFFSET_MS,
  TEMPLATE_DAYS,
  type TemplateKind,
} from "@funnel/shared";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 86_400_000;
export const CHAIN_MS = TEMPLATE_DAYS * DAY_MS;
export const GRACE_MS = 60 * MINUTE_MS;
export const DAILY_CAP = MESSAGE_DAILY_CEILING;
export const WATCHING_FRESH_MS = 2 * MINUTE_MS;
const UNCAPPED: SegmentCap = { daily: DAILY_CAP, total: null };
const stopAnchoredSegments: readonly FunnelSegment[] = ["B"];

export type ScheduleTemplate = {
  id: number;
  day: number;
  position: number;
  timingValue: number;
  kind: TemplateKind;
  atExpiry: boolean;
  statuses?: readonly FunnelStatus[] | null;
};

export type FunnelGrant = { day: number; expiresAt: Date | null };

export type WatchSnapshot = { lastBeatAt: Date | null; playing: boolean };

export type SendUsage = { today: number; runToday: number; runTotal: number };

export type PlanItem<T extends ScheduleTemplate = ScheduleTemplate> = {
  template: T;
  sendAt: Date;
};

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

export function linkExpiryFor(givenAt: Date, ttlHours: number): Date {
  const raw = new Date(givenAt.getTime() + ttlHours * HOUR_MS);
  const morning = nightMorningOf(raw);
  return morning === null ? raw : new Date(morning + EXTENDED_EXPIRY_MINUTE * MINUTE_MS);
}

export function funnelDayAt(grant: FunnelGrant, now: Date): number {
  if (!grant.expiresAt || now.getTime() < grant.expiresAt.getTime()) return grant.day;
  return grant.day + 1 + Math.floor((now.getTime() - grant.expiresAt.getTime()) / DAY_MS);
}

function compareItems<T extends ScheduleTemplate>(a: PlanItem<T>, b: PlanItem<T>): number {
  return (
    a.sendAt.getTime() - b.sendAt.getTime() ||
    a.template.day - b.template.day ||
    a.template.position - b.template.position ||
    a.template.id - b.template.id
  );
}

export function triggerSendAt(template: ScheduleTemplate, windowStart: Date): Date {
  if (template.atExpiry) return windowStart;
  const start = windowStart.getTime();
  const minuteStart = start - (((start % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
  const ahead = (template.timingValue - tashkentMinuteOfDay(windowStart) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const candidate = minuteStart + ahead * MINUTE_MS;
  return new Date(candidate < start ? candidate + DAY_MS : candidate);
}

function linkChain<T extends ScheduleTemplate>(templates: T[], anchorAt: Date, grant: FunnelGrant | null): PlanItem<T>[] {
  const day = grant?.day ?? 1;
  const expiresAt = grant?.expiresAt ?? null;
  const reminders = templates
    .filter((template) => template.kind === "reminder" && template.day === day)
    .map((template) => ({ template, sendAt: new Date(anchorAt.getTime() + template.timingValue * MINUTE_MS) }))
    .filter((item) => !expiresAt || item.sendAt.getTime() < expiresAt.getTime());
  if (!expiresAt) return reminders;
  const triggers = templates
    .filter((template) => template.kind === "trigger" && template.day > day && template.day <= TEMPLATE_DAYS)
    .map((template) => ({
      template,
      sendAt: triggerSendAt(template, new Date(expiresAt.getTime() + (template.day - day - 1) * DAY_MS)),
    }));
  return [...reminders, ...triggers];
}

function trackChain<T extends ScheduleTemplate>(templates: T[], enteredAt: Date, anchorAt: Date): PlanItem<T>[] {
  const firstDay = tashkentDayStart(enteredAt).getTime();
  return templates.map((template) => {
    const offset = template.timingValue * MINUTE_MS;
    const sendAt =
      template.day <= 1 ? anchorAt.getTime() + offset : firstDay + (template.day - 1) * DAY_MS + offset;
    return { template, sendAt: new Date(sendAt) };
  });
}

export type ChainRun = {
  segment: FunnelSegment;
  enteredAt: Date;
  status?: FunnelStatus | null;
  watch?: WatchSnapshot | null;
  grant?: FunnelGrant | null;
};

export function planChain<T extends ScheduleTemplate>(templates: T[], run: ChainRun): PlanItem<T>[] {
  const eligible = run.status === undefined ? templates : templatesForStatus(templates, run.status);
  const anchorAt = chainAnchor(run, run.watch ?? null);
  const items = linkBoundSegments.includes(run.segment)
    ? linkChain(eligible, anchorAt, run.grant ?? null)
    : trackChain(eligible, run.enteredAt, anchorAt);
  return items.sort(compareItems);
}

export function chainAnchor(run: { segment: FunnelSegment; enteredAt: Date }, watch: WatchSnapshot | null): Date {
  const stoppedAt = watch?.lastBeatAt ?? null;
  if (!stopAnchoredSegments.includes(run.segment) || stoppedAt === null) return run.enteredAt;
  return stoppedAt.getTime() > run.enteredAt.getTime() ? stoppedAt : run.enteredAt;
}

export function isWatchingNow(watch: WatchSnapshot | null, now: Date): boolean {
  if (!watch?.playing || watch.lastBeatAt === null) return false;
  return now.getTime() - watch.lastBeatAt.getTime() < WATCHING_FRESH_MS;
}

export function templatesForStatus<T extends Pick<ScheduleTemplate, "statuses">>(
  templates: T[],
  status: FunnelStatus | null,
): T[] {
  return templates.filter(
    (template) => !template.statuses || (status !== null && template.statuses.includes(status)),
  );
}

export function capReached(usage: SendUsage, cap: SegmentCap): boolean {
  return (
    usage.today >= DAILY_CAP ||
    usage.runToday >= cap.daily ||
    (cap.total !== null && usage.runTotal >= cap.total)
  );
}

export function pickNext<T extends ScheduleTemplate>(
  plan: PlanItem<T>[],
  sent: ReadonlySet<number>,
  now: Date,
  usage: SendUsage,
  cap: SegmentCap = UNCAPPED,
): PlanItem<T> | null {
  if (capReached(usage, cap)) return null;
  const nowMs = now.getTime();
  const found = plan.find(
    (item) => !sent.has(item.template.id) && item.sendAt.getTime() <= nowMs && nowMs - item.sendAt.getTime() <= GRACE_MS,
  );
  return found ?? null;
}

export function nextPendingDue<T extends ScheduleTemplate>(
  plan: PlanItem<T>[],
  sent: ReadonlySet<number>,
  now: Date,
): Date | null {
  const nowMs = now.getTime();
  const found = plan.find((item) => !sent.has(item.template.id) && nowMs - item.sendAt.getTime() <= GRACE_MS);
  return found?.sendAt ?? null;
}
