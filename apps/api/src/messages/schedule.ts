import {
  isNightMinute,
  NIGHT,
  TASHKENT_OFFSET_MS,
  TEMPLATE_DAYS,
  type TimingType,
} from "@funnel/shared";

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;
export const CHAIN_MS = TEMPLATE_DAYS * DAY_MS;
export const GRACE_MS = 60 * MINUTE_MS;
export const DAILY_CAP = 10;

export type ScheduleTemplate = {
  id: number;
  day: number;
  position: number;
  timingType: TimingType;
  timingValue: number;
};
export type ScheduleRun = { enteredAt: Date; linkExpiresAt: Date | null };
export type DueItem<T extends ScheduleTemplate> = { template: T; dueAt: Date };

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

export function shiftOutOfNight(date: Date): Date {
  const minute = tashkentMinuteOfDay(date);
  if (!isNightMinute(minute)) return date;
  const dayStart = tashkentDayStart(date).getTime();
  const nextMorning = NIGHT.end * MINUTE_MS;
  return new Date(minute >= NIGHT.start ? dayStart + DAY_MS + nextMorning : dayStart + nextMorning);
}

export function dueAt(template: ScheduleTemplate, run: ScheduleRun): Date | null {
  const entry = run.enteredAt.getTime();
  const value = template.timingValue * MINUTE_MS;

  if (template.timingType === "after_entry") {
    return shiftOutOfNight(new Date(entry + value));
  }

  if (template.timingType === "day_time") {
    const raw = tashkentDayStart(run.enteredAt).getTime() + (template.day - 1) * DAY_MS + value;
    return raw < entry ? null : shiftOutOfNight(new Date(raw));
  }

  if (run.linkExpiresAt === null) return null;
  const raw = run.linkExpiresAt.getTime() - value;
  if (raw < entry || raw >= entry + CHAIN_MS) return null;
  const shifted = shiftOutOfNight(new Date(raw));
  return shifted.getTime() >= run.linkExpiresAt.getTime() ? null : shifted;
}

export function pendingSchedule<T extends ScheduleTemplate>(
  templates: T[],
  run: ScheduleRun,
  sentTemplateIds: ReadonlySet<number>,
): DueItem<T>[] {
  const items: DueItem<T>[] = [];
  for (const template of templates) {
    if (sentTemplateIds.has(template.id)) continue;
    const due = dueAt(template, run);
    if (due) items.push({ template, dueAt: due });
  }
  return items.sort(
    (a, b) =>
      a.dueAt.getTime() - b.dueAt.getTime() ||
      a.template.day - b.template.day ||
      a.template.position - b.template.position ||
      a.template.id - b.template.id,
  );
}

function carriedOverNight<T extends ScheduleTemplate>(item: DueItem<T>, now: Date): DueItem<T> {
  if (isNightAt(item.dueAt)) return item;
  const nightStart = tashkentDayStart(item.dueAt).getTime() + NIGHT.start * MINUTE_MS;
  const reachedNight = now.getTime() >= nightStart;
  const closeToNight = nightStart - item.dueAt.getTime() <= GRACE_MS;
  if (!reachedNight || !closeToNight) return item;
  return { template: item.template, dueAt: shiftOutOfNight(new Date(nightStart)) };
}

function effectiveSchedule<T extends ScheduleTemplate>(pending: DueItem<T>[], now: Date): DueItem<T>[] {
  return pending.map((item) => carriedOverNight(item, now)).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function pickNext<T extends ScheduleTemplate>(
  pending: DueItem<T>[],
  now: Date,
  sentToday: number,
): DueItem<T> | null {
  if (sentToday >= DAILY_CAP || isNightAt(now)) return null;
  const nowMs = now.getTime();
  const found = effectiveSchedule(pending, now).find(
    (item) => item.dueAt.getTime() <= nowMs && nowMs - item.dueAt.getTime() <= GRACE_MS,
  );
  return found ?? null;
}

export function nextPendingDue<T extends ScheduleTemplate>(pending: DueItem<T>[], now: Date): Date | null {
  const nowMs = now.getTime();
  const found = effectiveSchedule(pending, now).find((item) => nowMs - item.dueAt.getTime() <= GRACE_MS);
  return found?.dueAt ?? null;
}
