import {
  type AppointmentPurpose,
  LATER_FIRST_HOUR,
  LATER_LAST_HOUR,
  LATER_PRE_REMINDER_MINUTES,
  type LaterDayOffset,
  type LaterQuickSlot,
  laterDayOffsets,
  laterQuickSlotKeys,
  laterQuickSlots,
} from "@funnel/shared";
import { DAY_MS, HOUR_MS, isNightAt, MINUTE_MS, tashkentDayStart } from "@/messages/plan";

export type PickerContext = { now: Date; purpose: AppointmentPurpose; expiresAt: Date | null };

export type QuickSlot = { slot: LaterQuickSlot; hour: number; at: Date };

export function slotAt(now: Date, dayOffset: number, hour: number): Date {
  return new Date(tashkentDayStart(now).getTime() + dayOffset * DAY_MS + hour * HOUR_MS);
}

export function isSlotOpen(context: PickerContext, at: Date): boolean {
  if (at.getTime() <= context.now.getTime() || isNightAt(at)) return false;
  if (context.purpose === "reopen" || context.expiresAt === null) return true;
  return at.getTime() < context.expiresAt.getTime() - HOUR_MS;
}

export function quickSlots(context: PickerContext): QuickSlot[] {
  return laterQuickSlotKeys
    .map((slot) => {
      const { dayOffset, hour } = laterQuickSlots[slot];
      return { slot, hour, at: slotAt(context.now, dayOffset, hour) };
    })
    .filter((quick) => isSlotOpen(context, quick.at));
}

export function hourOptions(context: PickerContext, dayOffset: number): number[] {
  const hours: number[] = [];
  for (let hour = LATER_FIRST_HOUR; hour <= LATER_LAST_HOUR; hour += 1) {
    if (isSlotOpen(context, slotAt(context.now, dayOffset, hour))) hours.push(hour);
  }
  return hours;
}

export function dayOptions(context: PickerContext): LaterDayOffset[] {
  return laterDayOffsets.filter((dayOffset) => hourOptions(context, dayOffset).length > 0);
}

export function preReminderAt(chosenAt: Date, createdAt: Date): Date | null {
  const at = new Date(chosenAt.getTime() - LATER_PRE_REMINDER_MINUTES * MINUTE_MS);
  return at.getTime() <= createdAt.getTime() || isNightAt(at) ? null : at;
}
