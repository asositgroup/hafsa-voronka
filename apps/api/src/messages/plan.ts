import {
  EXTENDED_EXPIRY_MINUTE,
  type FunnelSegment,
  type FunnelStatus,
  isNightMinute,
  linkBoundSegments,
  MESSAGE_DAILY_CEILING,
  NIGHT,
  type SegmentCap,
  TASHKENT_OFFSET_MS,
  TEMPLATE_DAYS,
  templatesForAttempt,
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
  statuses?: readonly FunnelStatus[] | null;
  attempts?: readonly number[] | null;
};

export type WatchSnapshot = { lastBeatAt: Date | null; playing: boolean };

export type SendUsage = { today: number; runToday: number; runTotal: number };

export type PlanItem<T extends ScheduleTemplate = ScheduleTemplate> = {
  template: T;
  scheduledAt: Date;
  sendAt: Date;
};

export type PlanInput<T extends ScheduleTemplate = ScheduleTemplate> = {
  templates: T[];
  enteredAt: Date;
  anchorAt: Date;
  linkExpiresAt?: Date | null;
  deferredSent?: boolean;
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

function sendTime(template: ScheduleTemplate, input: PlanInput): Date {
  const offset = template.timingValue * MINUTE_MS;
  if (template.day <= 1) return new Date(input.anchorAt.getTime() + offset);
  return new Date(tashkentDayStart(input.enteredAt).getTime() + (template.day - 1) * DAY_MS + offset);
}

function effectiveSendAt(template: ScheduleTemplate, scheduledAt: Date, linkExpiresAt: Date | null | undefined): Date {
  if (template.day <= 1 || !linkExpiresAt || scheduledAt.getTime() >= linkExpiresAt.getTime()) return scheduledAt;
  return linkExpiresAt;
}

function compareItems<T extends ScheduleTemplate>(a: PlanItem<T>, b: PlanItem<T>): number {
  return (
    a.sendAt.getTime() - b.sendAt.getTime() ||
    a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
    a.template.day - b.template.day ||
    a.template.position - b.template.position ||
    a.template.id - b.template.id
  );
}

function closedBeforeSend(item: PlanItem, linkExpiresAt: Date | null | undefined): boolean {
  return item.template.day <= 1 && !!linkExpiresAt && item.scheduledAt.getTime() >= linkExpiresAt.getTime();
}

function isDeferred(item: PlanItem): boolean {
  return item.sendAt.getTime() > item.scheduledAt.getTime();
}

function withinTimeline(at: Date, input: PlanInput): boolean {
  return at.getTime() < tashkentDayStart(input.enteredAt).getTime() + CHAIN_MS;
}

export function planChain<T extends ScheduleTemplate>(input: PlanInput<T>): PlanItem<T>[] {
  const items = input.templates
    .map((template) => {
      const scheduledAt = sendTime(template, input);
      return { template, scheduledAt, sendAt: effectiveSendAt(template, scheduledAt, input.linkExpiresAt) };
    })
    .filter((item) => !closedBeforeSend(item, input.linkExpiresAt))
    .sort(compareItems);
  const firstDeferred = items.find(isDeferred);
  const keptDeferred =
    !input.deferredSent && firstDeferred && withinTimeline(firstDeferred.sendAt, input) ? firstDeferred : null;
  return items.filter((item) => !isDeferred(item) || item === keptDeferred);
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

export function segmentChainInput<T extends ScheduleTemplate>(
  templates: T[],
  run: {
    segment: FunnelSegment;
    enteredAt: Date;
    status?: FunnelStatus | null;
    watch?: WatchSnapshot | null;
    attempt?: number;
    linkExpiresAt?: Date | null;
    deferredSent?: boolean;
  },
): PlanInput<T> {
  const forLink = run.attempt === undefined ? templates : templatesForAttempt(templates, run.attempt);
  return {
    templates: run.status === undefined ? forLink : templatesForStatus(forLink, run.status),
    enteredAt: run.enteredAt,
    anchorAt: chainAnchor(run, run.watch ?? null),
    linkExpiresAt: linkBoundSegments.includes(run.segment) ? run.linkExpiresAt : null,
    deferredSent: run.deferredSent,
  };
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
