import { describe, expect, it } from "vitest";
import {
  dayOptions,
  hourOptions,
  preReminderAt,
  quickSlots,
  slotAt,
  type PickerContext,
} from "./laterPicker";

const local = (value: string) => new Date(`${value}+05:00`);

function reopen(now: string): PickerContext {
  return { now: local(now), purpose: "reopen", expiresAt: null };
}

function remind(now: string, expiresAt: string): PickerContext {
  return { now: local(now), purpose: "remind", expiresAt: local(expiresAt) };
}

describe("slotAt", () => {
  it("places an hour on a Tashkent day relative to today", () => {
    const now = local("2026-10-20T19:30:00");
    expect(slotAt(now, 0, 20)).toEqual(local("2026-10-20T20:00:00"));
    expect(slotAt(now, 1, 8)).toEqual(local("2026-10-21T08:00:00"));
    expect(slotAt(now, 2, 7)).toEqual(local("2026-10-22T07:00:00"));
  });

  it("uses the Tashkent day even when UTC is still on the previous date", () => {
    expect(slotAt(local("2026-10-20T02:00:00"), 0, 8)).toEqual(local("2026-10-20T08:00:00"));
  });
});

describe("quickSlots", () => {
  it("offers the three TZ slots with their fixed hours", () => {
    const slots = quickSlots(reopen("2026-10-20T10:00:00"));
    expect(slots.map((slot) => [slot.slot, slot.hour, slot.at])).toEqual([
      ["tonight", 20, local("2026-10-20T20:00:00")],
      ["tomorrowMorning", 8, local("2026-10-21T08:00:00")],
      ["tomorrowEvening", 20, local("2026-10-21T20:00:00")],
    ]);
  });

  it("shows tonight at 19:30 and hides it at 20:00", () => {
    expect(quickSlots(reopen("2026-10-20T19:30:00")).map((slot) => slot.slot)).toContain("tonight");
    expect(quickSlots(reopen("2026-10-20T20:00:00")).map((slot) => slot.slot)).not.toContain("tonight");
    expect(quickSlots(reopen("2026-10-20T20:01:00")).map((slot) => slot.slot)).toEqual([
      "tomorrowMorning",
      "tomorrowEvening",
    ]);
  });

  it("hides slots a live link would not reach, keeping one hour of margin", () => {
    expect(quickSlots(remind("2026-10-20T10:00:00", "2026-10-21T09:00:00")).map((slot) => slot.slot)).toEqual([
      "tonight",
    ]);
    expect(quickSlots(remind("2026-10-20T10:00:00", "2026-10-21T09:01:00")).map((slot) => slot.slot)).toEqual([
      "tonight",
      "tomorrowMorning",
    ]);
  });
});

describe("hourOptions", () => {
  it("offers 07 to 22 for a future day", () => {
    expect(hourOptions(reopen("2026-10-20T10:00:00"), 2)).toEqual(Array.from({ length: 16 }, (_, index) => 7 + index));
  });

  it("never offers night hours", () => {
    const hours = hourOptions(reopen("2026-10-20T02:00:00"), 1);
    expect(hours).not.toContain(23);
    expect(hours).not.toContain(6);
    expect(Math.min(...hours)).toBe(7);
    expect(Math.max(...hours)).toBe(22);
  });

  it("hides hours that are not after now", () => {
    expect(hourOptions(reopen("2026-10-20T13:30:00"), 0)).toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(hourOptions(reopen("2026-10-20T14:00:00"), 0)[0]).toBe(15);
  });

  it("starts at 07 when asked in the early morning", () => {
    expect(hourOptions(reopen("2026-10-20T03:00:00"), 0)[0]).toBe(7);
  });

  it("hides hours at or after one hour before the link ends for a reminder", () => {
    expect(hourOptions(remind("2026-10-20T10:00:00", "2026-10-20T18:30:00"), 0)).toEqual([11, 12, 13, 14, 15, 16, 17]);
    expect(hourOptions(remind("2026-10-20T10:00:00", "2026-10-20T18:00:00"), 0)).toEqual([11, 12, 13, 14, 15, 16]);
  });

  it("does not limit a reopen by any link expiry", () => {
    const context: PickerContext = {
      now: local("2026-10-20T10:00:00"),
      purpose: "reopen",
      expiresAt: local("2026-10-20T11:00:00"),
    };
    expect(hourOptions(context, 1)).toHaveLength(16);
  });
});

describe("dayOptions", () => {
  it("lists every day that still has an hour", () => {
    expect(dayOptions(reopen("2026-10-20T10:00:00"))).toEqual([0, 1, 2]);
  });

  it("drops today after the last hour", () => {
    expect(dayOptions(reopen("2026-10-20T22:00:00"))).toEqual([1, 2]);
    expect(dayOptions(reopen("2026-10-20T22:30:00"))).toEqual([1, 2]);
    expect(dayOptions(reopen("2026-10-20T21:59:00"))).toEqual([0, 1, 2]);
  });

  it("drops days past a live link for a reminder and can be empty", () => {
    expect(dayOptions(remind("2026-10-20T10:00:00", "2026-10-21T10:00:00"))).toEqual([0, 1]);
    expect(dayOptions(remind("2026-10-20T22:30:00", "2026-10-21T06:00:00"))).toEqual([]);
  });
});

describe("preReminderAt", () => {
  const createdAt = local("2026-10-20T10:00:00");

  it("is one hour before the chosen time", () => {
    expect(preReminderAt(local("2026-10-20T20:00:00"), createdAt)).toEqual(local("2026-10-20T19:00:00"));
    expect(preReminderAt(local("2026-10-21T08:00:00"), createdAt)).toEqual(local("2026-10-21T07:00:00"));
  });

  it("is skipped when it would land at night", () => {
    expect(preReminderAt(local("2026-10-21T07:00:00"), createdAt)).toBeNull();
    expect(preReminderAt(local("2026-10-21T07:30:00"), createdAt)).toBeNull();
  });

  it("is skipped when the chosen time is less than an hour away", () => {
    expect(preReminderAt(local("2026-10-20T10:30:00"), createdAt)).toBeNull();
    expect(preReminderAt(local("2026-10-20T11:00:00"), createdAt)).toBeNull();
  });

  it("is kept when the chosen time is just over an hour away", () => {
    expect(preReminderAt(local("2026-10-20T11:01:00"), createdAt)).toEqual(local("2026-10-20T10:01:00"));
  });
});
