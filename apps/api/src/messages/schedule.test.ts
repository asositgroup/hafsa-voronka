import { describe, expect, it } from "vitest";
import {
  DAILY_CAP,
  dueAt,
  GRACE_MS,
  isNightAt,
  nextPendingDue,
  pendingSchedule,
  pickNext,
  type ScheduleTemplate,
  shiftOutOfNight,
  tashkentDayStart,
} from "./schedule";

const local = (value: string) => new Date(`${value}+05:00`);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const entry = local("2026-10-19T10:00:00");
const run = { enteredAt: entry, linkExpiresAt: null };

let nextId = 1;

function template(overrides: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
  return { id: nextId++, day: 1, position: 0, timingType: "after_entry", timingValue: 60, ...overrides };
}

describe("tashkentDayStart", () => {
  it("keeps the local calendar day at the edges", () => {
    expect(tashkentDayStart(local("2026-10-19T23:59:59"))).toEqual(local("2026-10-19T00:00:00"));
    expect(tashkentDayStart(local("2026-10-20T00:00:00"))).toEqual(local("2026-10-20T00:00:00"));
  });
});

describe("isNightAt", () => {
  it("covers 23:00 to 07:00 local", () => {
    expect(isNightAt(local("2026-10-19T22:59:59"))).toBe(false);
    expect(isNightAt(local("2026-10-19T23:00:00"))).toBe(true);
    expect(isNightAt(local("2026-10-20T06:59:59"))).toBe(true);
    expect(isNightAt(local("2026-10-20T07:00:00"))).toBe(false);
  });
});

describe("shiftOutOfNight", () => {
  it("leaves daytime untouched", () => {
    expect(shiftOutOfNight(local("2026-10-19T22:59:00"))).toEqual(local("2026-10-19T22:59:00"));
    expect(shiftOutOfNight(local("2026-10-19T07:00:00"))).toEqual(local("2026-10-19T07:00:00"));
  });

  it("moves the evening night to 07:00 of the next day", () => {
    expect(shiftOutOfNight(local("2026-10-19T23:00:00"))).toEqual(local("2026-10-20T07:00:00"));
  });

  it("moves the early morning night to 07:00 of the same day", () => {
    expect(shiftOutOfNight(local("2026-10-20T03:00:00"))).toEqual(local("2026-10-20T07:00:00"));
    expect(shiftOutOfNight(local("2026-10-20T06:59:30"))).toEqual(local("2026-10-20T07:00:00"));
  });
});

describe("dueAt", () => {
  it("adds after_entry minutes to the entry", () => {
    expect(dueAt(template({ timingValue: 60 }), run)).toEqual(local("2026-10-19T11:00:00"));
  });

  it("shifts a night after_entry to the next 07:00", () => {
    expect(dueAt(template({ timingValue: 780 }), run)).toEqual(local("2026-10-20T07:00:00"));
  });

  it("keeps a late day-7 after_entry that shifts past the chain", () => {
    expect(dueAt(template({ day: 7, timingValue: 9420 }), run)).toEqual(local("2026-10-26T07:00:00"));
  });

  it("skips a day_time that had already passed at entry", () => {
    expect(dueAt(template({ timingType: "day_time", timingValue: 540 }), run)).toBeNull();
  });

  it("schedules day_time on the same day when still ahead", () => {
    expect(dueAt(template({ timingType: "day_time", timingValue: 720 }), run)).toEqual(local("2026-10-19T12:00:00"));
  });

  it("counts day_time days as calendar days", () => {
    const day2 = template({ day: 2, timingType: "day_time", timingValue: 540 });
    expect(dueAt(day2, run)).toEqual(local("2026-10-20T09:00:00"));

    const lateRun = { enteredAt: local("2026-10-19T23:30:00"), linkExpiresAt: null };
    expect(dueAt(template({ timingType: "day_time", timingValue: 540 }), lateRun)).toBeNull();
    expect(dueAt(day2, lateRun)).toEqual(local("2026-10-20T09:00:00"));
  });

  it("keeps a day_time exactly at the entry", () => {
    const exact = { enteredAt: local("2026-10-19T09:00:00"), linkExpiresAt: null };
    expect(dueAt(template({ timingType: "day_time", timingValue: 540 }), exact)).toEqual(exact.enteredAt);
  });

  it("returns null for before_expiry without a link expiry", () => {
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 120 }), run)).toBeNull();
  });

  it("subtracts before_expiry minutes from the expiry", () => {
    const expiring = { enteredAt: entry, linkExpiresAt: new Date(entry.getTime() + 72 * HOUR) };
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 120 }), expiring)).toEqual(
      new Date(entry.getTime() + 70 * HOUR),
    );
  });

  it("drops before_expiry that falls before the entry", () => {
    const expiring = { enteredAt: entry, linkExpiresAt: new Date(entry.getTime() + HOUR) };
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 120 }), expiring)).toBeNull();
  });

  it("drops before_expiry beyond the seven day chain", () => {
    const expiring = { enteredAt: entry, linkExpiresAt: new Date(entry.getTime() + 10 * DAY) };
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 120 }), expiring)).toBeNull();
  });

  it("drops a night before_expiry that shifts past the expiry", () => {
    const expiring = { enteredAt: entry, linkExpiresAt: local("2026-10-20T02:00:00") };
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 60 }), expiring)).toBeNull();
  });

  it("keeps a night before_expiry that shifts to before the expiry", () => {
    const expiring = { enteredAt: entry, linkExpiresAt: local("2026-10-20T08:00:00") };
    expect(dueAt(template({ timingType: "before_expiry", timingValue: 120 }), expiring)).toEqual(
      local("2026-10-20T07:00:00"),
    );
  });
});

describe("pendingSchedule", () => {
  it("drops sent templates and templates without a due time", () => {
    const sent = template({ timingValue: 10 });
    const skipped = template({ timingType: "before_expiry", timingValue: 60 });
    const kept = template({ timingValue: 20 });
    const pending = pendingSchedule([sent, skipped, kept], run, new Set([sent.id]));
    expect(pending.map((item) => item.template.id)).toEqual([kept.id]);
  });

  it("breaks equal due times by day, position, then id", () => {
    const a = template({ day: 1, position: 1, timingValue: 60 });
    const b = template({ day: 1, position: 0, timingValue: 60 });
    const c = template({ day: 1, position: 0, timingValue: 60 });
    const d = template({ day: 2, position: 0, timingType: "after_entry", timingValue: 60 });
    const pending = pendingSchedule([d, a, c, b], run, new Set());
    expect(pending.map((item) => item.template.id)).toEqual([b.id, c.id, a.id, d.id]);
  });

  it("orders by due time first", () => {
    const late = template({ position: 0, timingValue: 120 });
    const early = template({ position: 5, timingValue: 30 });
    const pending = pendingSchedule([late, early], run, new Set());
    expect(pending.map((item) => item.template.id)).toEqual([early.id, late.id]);
  });
});

describe("pickNext", () => {
  const first = template({ timingValue: 60 });
  const second = template({ timingValue: 90 });
  const pending = (templates: ScheduleTemplate[]) => pendingSchedule(templates, run, new Set());
  const dueTime = local("2026-10-19T11:00:00");

  it("picks a message that is due now", () => {
    expect(pickNext(pending([first]), dueTime, 0)?.template.id).toBe(first.id);
  });

  it("picks a message due 59 minutes ago but not 61", () => {
    expect(pickNext(pending([first]), new Date(dueTime.getTime() + 59 * MINUTE), 0)?.template.id).toBe(first.id);
    expect(pickNext(pending([first]), new Date(dueTime.getTime() + GRACE_MS + MINUTE), 0)).toBeNull();
  });

  it("waits for a future message", () => {
    expect(pickNext(pending([first]), new Date(dueTime.getTime() - MINUTE), 0)).toBeNull();
  });

  it("stops at the daily cap", () => {
    expect(pickNext(pending([first]), dueTime, DAILY_CAP)).toBeNull();
    expect(pickNext(pending([first]), dueTime, DAILY_CAP - 1)?.template.id).toBe(first.id);
  });

  it("never picks at night", () => {
    expect(pickNext(pending([first]), local("2026-10-19T23:30:00"), 0)).toBeNull();
  });

  it("picks the earliest of two due messages", () => {
    const now = new Date(dueTime.getTime() + 40 * MINUTE);
    expect(pickNext(pending([second, first]), now, 0)?.template.id).toBe(first.id);
  });

  describe("carried over the night", () => {
    const evening = template({ timingType: "day_time", timingValue: 22 * 60 + 59 });
    const eveningRun = { enteredAt: local("2026-10-19T08:00:00"), linkExpiresAt: null };
    const eveningPending = pendingSchedule([evening], eveningRun, new Set());

    it("sends a message due 22:59 at the next 07:00 instead of losing it", () => {
      expect(pickNext(eveningPending, local("2026-10-19T22:59:00"), 0)?.template.id).toBe(evening.id);
      expect(pickNext(eveningPending, local("2026-10-19T23:00:00"), 0)).toBeNull();
      expect(pickNext(eveningPending, local("2026-10-20T06:59:00"), 0)).toBeNull();
      const picked = pickNext(eveningPending, local("2026-10-20T07:00:00"), 0);
      expect(picked?.template.id).toBe(evening.id);
      expect(picked?.dueAt).toEqual(local("2026-10-20T07:00:00"));
    });

    it("expires the carried message after the grace from 07:00", () => {
      expect(pickNext(eveningPending, local("2026-10-20T07:59:00"), 0)?.template.id).toBe(evening.id);
      expect(pickNext(eveningPending, local("2026-10-20T08:01:00"), 0)).toBeNull();
    });

    it("does not carry a message that was already stale before the night", () => {
      const stale = template({ timingType: "day_time", timingValue: 21 * 60 });
      const items = pendingSchedule([stale], eveningRun, new Set());
      expect(pickNext(items, local("2026-10-20T07:00:00"), 0)).toBeNull();
    });
  });
});

describe("nextPendingDue", () => {
  const now = local("2026-10-19T12:00:00");
  const pending = (templates: ScheduleTemplate[]) => pendingSchedule(templates, run, new Set());

  it("returns the next future item", () => {
    expect(nextPendingDue(pending([template({ timingValue: 240 })]), now)).toEqual(local("2026-10-19T14:00:00"));
  });

  it("ignores items older than the grace", () => {
    const stale = template({ timingValue: 10 });
    const upcoming = template({ timingValue: 300 });
    expect(nextPendingDue(pending([stale, upcoming]), now)).toEqual(local("2026-10-19T15:00:00"));
  });

  it("returns an item still inside the grace", () => {
    expect(nextPendingDue(pending([template({ timingValue: 90 })]), now)).toEqual(local("2026-10-19T11:30:00"));
  });

  it("returns null when nothing is pending", () => {
    expect(nextPendingDue([], now)).toBeNull();
  });
});
