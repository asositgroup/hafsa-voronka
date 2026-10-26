import { describe, expect, it } from "vitest";
import {
  capReached,
  chainAnchor,
  DAILY_CAP,
  GRACE_MS,
  isWatchingNow,
  isNightAt,
  linkExpiryFor,
  nextPendingDue,
  pickNext,
  planChain,
  type ScheduleTemplate,
  segmentChainInput,
  type SendUsage,
  tashkentDayStart,
  templatesForStatus,
} from "./plan";

const local = (value: string) => new Date(`${value}+05:00`);
const T = (value: string) => local(value.replace(" ", "T"));
const MINUTE = 60_000;

let nextId = 1;

function template(overrides: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
  return { id: nextId++, day: 1, position: 0, timingValue: 60, ...overrides };
}

const unused: SendUsage = { today: 0, runToday: 0, runTotal: 0 };
const none = new Set<number>();

function localTime(date: Date) {
  return new Date(date.getTime() + 5 * 60 * MINUTE).toISOString().slice(0, 16);
}

function planFor(templates: ScheduleTemplate[], run: { segment?: "A" | "B" | "C"; entered: string; lastBeatAt?: string }) {
  return planChain(
    segmentChainInput(templates, {
      segment: run.segment ?? "A",
      enteredAt: T(run.entered),
      watch: run.lastBeatAt ? { lastBeatAt: T(run.lastBeatAt), playing: false } : null,
    }),
  );
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

describe("linkExpiryFor", () => {
  it("keeps an expiry that falls in the day", () => {
    expect(linkExpiryFor(local("2026-10-19T10:00"), 24)).toEqual(local("2026-10-20T10:00"));
    expect(linkExpiryFor(local("2026-10-19T22:59"), 24)).toEqual(local("2026-10-20T22:59"));
    expect(linkExpiryFor(local("2026-10-19T07:00"), 24)).toEqual(local("2026-10-20T07:00"));
  });

  it("extends an expiry from 23:00 to 09:00 of the next morning", () => {
    expect(linkExpiryFor(local("2026-10-19T23:00"), 24)).toEqual(local("2026-10-21T09:00"));
    expect(linkExpiryFor(local("2026-10-19T23:30"), 24)).toEqual(local("2026-10-21T09:00"));
  });

  it("extends an early morning expiry to 09:00 of the same day", () => {
    expect(linkExpiryFor(local("2026-10-19T02:00"), 24)).toEqual(local("2026-10-20T09:00"));
    expect(linkExpiryFor(local("2026-10-19T06:59"), 24)).toEqual(local("2026-10-20T09:00"));
  });

  it("works for any link length", () => {
    expect(linkExpiryFor(local("2026-10-19T10:00"), 15)).toEqual(local("2026-10-20T09:00"));
    expect(linkExpiryFor(local("2026-10-19T10:00"), 72)).toEqual(local("2026-10-22T10:00"));
  });
});

describe("planChain: seven-day timeline", () => {
  it("times day 1 from the stage entry", () => {
    const plan = planFor([template({ day: 1, timingValue: 60 })], { entered: "2026-10-20 10:00" });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-20 11:00")]);
  });

  it("times B day 1 from the last pause", () => {
    const plan = planFor([template({ day: 1, timingValue: 30 })], {
      segment: "B",
      entered: "2026-10-20 10:00",
      lastBeatAt: "2026-10-20 12:00",
    });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-20 12:30")]);
  });

  it("puts day N at the clock time of the Nth Tashkent day from entry", () => {
    const plan = planFor([template({ day: 3, timingValue: 600 })], { entered: "2026-10-20 15:00" });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-22 10:00")]);
  });

  it("counts B days from entry, not from the last pause", () => {
    const plan = planFor([template({ day: 2, timingValue: 600 })], {
      segment: "B",
      entered: "2026-10-20 10:00",
      lastBeatAt: "2026-10-21 09:00",
    });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-21 10:00")]);
  });

  it("starts day 2 at the next Tashkent midnight", () => {
    const plan = planFor([template({ day: 2, timingValue: 30 })], { entered: "2026-10-20 23:50" });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-21 00:30")]);
  });

  it("sends day-1 reminders that land at night as scheduled", () => {
    const plan = planFor([template({ day: 1, timingValue: 60 })], { entered: "2026-10-20 22:30" });
    expect(plan.map((item) => item.sendAt)).toEqual([T("2026-10-20 23:30")]);
    expect(pickNext(plan, none, T("2026-10-20 23:30"), unused)).toBe(plan[0]);
  });

  it("keeps two reminders a minute apart", () => {
    const first = template({ day: 2, timingValue: 600 });
    const second = template({ day: 2, timingValue: 601 });
    const plan = planFor([second, first], { entered: "2026-10-20 10:00" });
    expect(plan.map((item) => [item.template, localTime(item.sendAt)])).toEqual([
      [first, "2026-10-21T10:00"],
      [second, "2026-10-21T10:01"],
    ]);
    expect(pickNext(plan, none, T("2026-10-21 10:00"), unused)).toBe(plan[0]);
    expect(pickNext(plan, new Set([first.id]), T("2026-10-21 10:01"), unused)).toBe(plan[1]);
  });

  it("orders same-time reminders by position, then id", () => {
    const late = template({ id: 5003, day: 2, timingValue: 600, position: 1 });
    const second = template({ id: 5002, day: 2, timingValue: 600, position: 0 });
    const first = template({ id: 5001, day: 2, timingValue: 600, position: 0 });
    const plan = planFor([late, second, first], { entered: "2026-10-20 10:00" });
    expect(plan.map((item) => item.template.id)).toEqual([5001, 5002, 5003]);
  });
});

describe("pickNext and nextPendingDue", () => {
  const first = template({ day: 1, timingValue: 60 });
  const second = template({ day: 2, timingValue: 600 });
  const plan = planFor([first, second], { entered: "2026-10-20 10:00" });

  it("returns the item that is due", () => {
    expect(pickNext(plan, none, T("2026-10-20 11:00"), unused)).toBe(plan[0]);
    expect(pickNext(plan, none, T("2026-10-20 10:59"), unused)).toBeNull();
  });

  it("pickNext gives up after the grace period", () => {
    expect(pickNext(plan, none, new Date(plan[0].sendAt.getTime() + GRACE_MS), unused)).toBe(plan[0]);
    expect(pickNext(plan, none, T("2026-10-20 12:01"), unused)).toBeNull();
  });

  it("stops at the daily cap", () => {
    expect(pickNext(plan, none, T("2026-10-20 11:00"), { ...unused, today: DAILY_CAP })).toBeNull();
  });

  it("skips sent ids", () => {
    const sent = new Set([first.id]);
    expect(pickNext(plan, sent, T("2026-10-20 11:00"), unused)).toBeNull();
    expect(pickNext(plan, sent, T("2026-10-21 10:00"), unused)).toBe(plan[1]);
  });

  it("finds the next pending send", () => {
    expect(nextPendingDue(plan, none, T("2026-10-20 10:00"))).toEqual(T("2026-10-20 11:00"));
    expect(nextPendingDue(plan, new Set([first.id]), T("2026-10-20 10:00"))).toEqual(T("2026-10-21 10:00"));
    expect(nextPendingDue(plan, new Set([first.id, second.id]), T("2026-10-20 10:00"))).toBeNull();
  });
});

describe("segment B: anchor at the stop", () => {
  const entered = local("2026-10-19T10:00");
  const run = { segment: "B" as const, enteredAt: entered };

  it("anchors B runs to the last beat and other segments to the entry", () => {
    const beat = local("2026-10-19T10:40");
    expect(chainAnchor(run, { lastBeatAt: beat, playing: false })).toEqual(beat);
    expect(chainAnchor(run, { lastBeatAt: local("2026-10-19T09:00"), playing: false })).toEqual(entered);
    expect(chainAnchor(run, { lastBeatAt: null, playing: false })).toEqual(entered);
    expect(chainAnchor(run, null)).toEqual(entered);
    expect(chainAnchor({ segment: "A", enteredAt: entered }, { lastBeatAt: beat, playing: false })).toEqual(entered);
    expect(chainAnchor({ segment: "C", enteredAt: entered }, { lastBeatAt: beat, playing: false })).toEqual(entered);
  });

  it("treats only a fresh playing beat as watching", () => {
    const now = local("2026-10-19T12:00");
    expect(isWatchingNow({ lastBeatAt: new Date(now.getTime() - 119_000), playing: true }, now)).toBe(true);
    expect(isWatchingNow({ lastBeatAt: new Date(now.getTime() - 120_000), playing: true }, now)).toBe(false);
    expect(isWatchingNow({ lastBeatAt: new Date(now.getTime() - 10_000), playing: false }, now)).toBe(false);
    expect(isWatchingNow({ lastBeatAt: null, playing: true }, now)).toBe(false);
    expect(isWatchingNow(null, now)).toBe(false);
  });

  it("keeps a +30m item waiting while beats keep coming and sends it 30 minutes after the last one", () => {
    const thirty = template({ timingValue: 30 });
    const planAt = (beat: Date) =>
      planChain(segmentChainInput([thirty], { ...run, watch: { lastBeatAt: beat, playing: true } }));
    for (let minute = 0; minute <= 40; minute += 1) {
      const now = new Date(entered.getTime() + minute * MINUTE);
      expect(pickNext(planAt(now), new Set(), now, unused)).toBeNull();
    }
    const stoppedAt = local("2026-10-19T10:40");
    const plan = planAt(stoppedAt);
    expect(plan.map((item) => localTime(item.sendAt))).toEqual(["2026-10-19T11:10"]);
    expect(pickNext(plan, new Set(), local("2026-10-19T11:09"), unused)).toBeNull();
    expect(pickNext(plan, new Set(), local("2026-10-19T11:10"), unused)).toBe(plan[0]);
  });

  it("re-anchors unsent items to a new stop and keeps sent ones sent", () => {
    const thirty = template({ timingValue: 30 });
    const three = template({ timingValue: 180, position: 1 });
    const input = (beat: Date) =>
      segmentChainInput([thirty, three], { ...run, watch: { lastBeatAt: beat, playing: false } });
    const first = planChain(input(local("2026-10-19T10:10")));
    expect(first.map((item) => localTime(item.sendAt))).toEqual(["2026-10-19T10:40", "2026-10-19T13:10"]);
    const sent = new Set([first[0].template.id]);
    const second = planChain(input(local("2026-10-19T12:00")));
    expect(second.map((item) => localTime(item.sendAt))).toEqual(["2026-10-19T12:30", "2026-10-19T15:00"]);
    expect(pickNext(second, sent, local("2026-10-19T12:30"), unused)).toBeNull();
    expect(pickNext(second, sent, local("2026-10-19T15:00"), unused)?.template).toBe(three);
  });

});

describe("segment B: status variants", () => {
  const early = template({ id: 9001, statuses: ["korishni_boshladi"] });
  const middle = template({ id: 9002, statuses: ["dars_yarmida"] });
  const sales = template({ id: 9003, statuses: ["sotuvda_toxtadi"] });
  const everyone = template({ id: 9004, timingValue: 180, statuses: null });
  const all = [early, middle, sales, everyone];

  it("keeps templates without a filter and those matching the status", () => {
    expect(templatesForStatus(all, "korishni_boshladi")).toEqual([early, everyone]);
    expect(templatesForStatus(all, "dars_yarmida")).toEqual([middle, everyone]);
    expect(templatesForStatus(all, "sotuvda_toxtadi")).toEqual([sales, everyone]);
    expect(templatesForStatus(all, null)).toEqual([everyone]);
  });

  it("switches the variant of unsent items when the status changes", () => {
    const run = { segment: "B" as const, enteredAt: local("2026-10-19T10:00") };
    const planFor = (status: "korishni_boshladi" | "sotuvda_toxtadi", beat: string) =>
      planChain(segmentChainInput(all, { ...run, status, watch: { lastBeatAt: local(beat), playing: false } }));
    const first = planFor("korishni_boshladi", "2026-10-19T10:03");
    expect(first.map((item) => item.template.id)).toEqual([9001, 9004]);
    const sent = new Set([first[0].template.id]);
    const later = planFor("sotuvda_toxtadi", "2026-10-19T10:20");
    expect(later.map((item) => item.template.id)).toEqual([9003, 9004]);
    expect(pickNext(later, sent, local("2026-10-19T11:20"), unused)?.template.id).toBe(9003);
  });

  it("does not filter when no status is given", () => {
    const input = segmentChainInput(all, { segment: "B", enteredAt: local("2026-10-19T10:00") });
    expect(input.templates).toEqual(all);
  });
});

describe("link attempts", () => {
  const firstLinkOnly = template({ id: 9101, attempts: [1] });
  const reopened = template({ id: 9102, attempts: [2, 3] });
  const everyLink = template({ id: 9103, timingValue: 120, attempts: null });
  const all = [firstLinkOnly, reopened, everyLink];
  const run = { segment: "A" as const, enteredAt: local("2026-10-19T10:00") };

  it("sends texts targeted at the first link only on the first link", () => {
    const ids = (attempt: number) =>
      planChain(segmentChainInput(all, { ...run, attempt })).map((item) => item.template.id);
    expect(ids(1)).toEqual([9101, 9103]);
    expect(ids(2)).toEqual([9102, 9103]);
    expect(ids(4)).toEqual([9103]);
  });

  it("restarts the chain from the reopened link's own entry", () => {
    const reopenedRun = { ...run, enteredAt: local("2026-10-21T08:15"), attempt: 2 };
    const plan = planChain(segmentChainInput([...all, template({ day: 2, timingValue: 600 })], reopenedRun));
    expect(plan.map((item) => localTime(item.sendAt))).toEqual(["2026-10-21T09:15", "2026-10-21T10:15", "2026-10-22T10:00"]);
  });
});

describe("link expiry", () => {
  const expiresAt = T("2026-10-21 09:00");
  const planWithExpiry = (segment: "A" | "B" | "C", templates: ScheduleTemplate[], lastBeatAt?: string) =>
    planChain(
      segmentChainInput(templates, {
        segment,
        enteredAt: T("2026-10-20 09:00"),
        watch: lastBeatAt ? { lastBeatAt: T(lastBeatAt), playing: false } : null,
        linkExpiresAt: expiresAt,
      }),
    );

  it("drops day-1 reminders of A/B that fall at or after the link expiry", () => {
    const closing = [1140, 1260, 1380].map((timingValue) => template({ day: 1, timingValue }));
    const early = template({ day: 1, timingValue: 600 });
    const nextDay = template({ day: 2, timingValue: 600 });
    const plan = planWithExpiry("B", [...closing, early, nextDay], "2026-10-20 20:00");
    expect(plan.map((item) => [item.template, localTime(item.sendAt)])).toEqual([
      [early, "2026-10-21T06:00"],
      [nextDay, "2026-10-21T10:00"],
    ]);

    const atExpiry = template({ day: 1, timingValue: 1440 });
    const beforeExpiry = template({ day: 1, timingValue: 1439 });
    expect(planWithExpiry("A", [atExpiry, beforeExpiry]).map((item) => item.template)).toEqual([beforeExpiry]);
  });

  it("keeps day-1 reminders for C after the link expiry", () => {
    const late = template({ day: 1, timingValue: 1500 });
    expect(planWithExpiry("C", [late]).map((item) => localTime(item.sendAt))).toEqual(["2026-10-21T10:00"]);
  });

  it("keeps day-2+ reminders after the link expiry", () => {
    const days = [2, 3, 7].map((day) => template({ day, timingValue: 600 }));
    expect(planWithExpiry("A", days).map((item) => localTime(item.sendAt))).toEqual([
      "2026-10-21T10:00",
      "2026-10-22T10:00",
      "2026-10-26T10:00",
    ]);
  });

  it("keeps every day-1 reminder when there is no link expiry", () => {
    const late = template({ day: 1, timingValue: 1500 });
    const plan = planChain(segmentChainInput([late], { segment: "A", enteredAt: T("2026-10-20 09:00"), linkExpiresAt: null }));
    expect(plan.map((item) => localTime(item.sendAt))).toEqual(["2026-10-21T10:00"]);
  });
});

describe("caps", () => {
  const bCap = { daily: 4, total: 7 };
  const plan = planFor([template({ timingValue: 60 })], { entered: "2026-10-19 10:00" });
  const now = local("2026-10-19T11:00");

  it("blocks the fifth send of the day and the eighth of the run in B", () => {
    expect(capReached({ today: 3, runToday: 3, runTotal: 6 }, bCap)).toBe(false);
    expect(capReached({ today: 4, runToday: 4, runTotal: 4 }, bCap)).toBe(true);
    expect(capReached({ today: 1, runToday: 1, runTotal: 7 }, bCap)).toBe(true);
    expect(pickNext(plan, new Set(), now, { today: 4, runToday: 4, runTotal: 4 }, bCap)).toBeNull();
    expect(pickNext(plan, new Set(), now, { today: 0, runToday: 0, runTotal: 7 }, bCap)).toBeNull();
    expect(pickNext(plan, new Set(), now, { today: 3, runToday: 3, runTotal: 6 }, bCap)).toBe(plan[0]);
  });

  it("always applies the global ten per day", () => {
    const loose = { daily: 50, total: null };
    expect(capReached({ today: DAILY_CAP, runToday: 0, runTotal: 0 }, loose)).toBe(true);
    expect(capReached({ today: DAILY_CAP - 1, runToday: 9, runTotal: 100 }, loose)).toBe(false);
  });
});

describe("day 2+ reminders while the link is still open", () => {
  const planOpen = (segment: "A" | "B" | "C", templates: ScheduleTemplate[], given: string) =>
    planChain(
      segmentChainInput(templates, {
        segment,
        enteredAt: T(given),
        linkExpiresAt: linkExpiryFor(T(given), 24),
      }),
    );

  it("makes a day-2 reminder before the expiry due when the link closes", () => {
    const afsus = template({ day: 2, timingValue: 600 });
    const plan = planOpen("A", [afsus], "2026-10-20 15:00");
    expect(plan.map((item) => localTime(item.sendAt))).toEqual(["2026-10-21T15:00"]);
    expect(pickNext(plan, none, T("2026-10-21 10:00"), unused)).toBeNull();
    expect(pickNext(plan, none, T("2026-10-21 14:59"), unused)).toBeNull();
    expect(pickNext(plan, none, T("2026-10-21 15:00"), unused)).toBe(plan[0]);
    expect(pickNext(plan, none, T("2026-10-21 15:30"), unused)).toBe(plan[0]);
    expect(nextPendingDue(plan, none, T("2026-10-21 10:00"))).toEqual(T("2026-10-21 15:00"));
  });

  it("defers B the same way", () => {
    const afsus = template({ day: 2, timingValue: 600 });
    expect(planOpen("B", [afsus], "2026-10-20 15:00").map((item) => localTime(item.sendAt))).toEqual([
      "2026-10-21T15:00",
    ]);
  });

  it("defers only the first reminder to the night-extended expiry and keeps day 3", () => {
    const dayTwo = template({ day: 2, timingValue: 600 });
    const dayTwoLater = template({ day: 2, timingValue: 1080 });
    const early = template({ day: 3, timingValue: 480 });
    const after = template({ day: 3, timingValue: 600 });
    const afterLater = template({ day: 3, timingValue: 660 });
    const plan = planOpen("A", [afterLater, after, early, dayTwoLater, dayTwo], "2026-10-20 23:30");
    expect(plan.map((item) => [item.template, localTime(item.sendAt)])).toEqual([
      [dayTwo, "2026-10-22T09:00"],
      [after, "2026-10-22T10:00"],
      [afterLater, "2026-10-22T11:00"],
    ]);
  });

  it("keeps a reminder that falls after the expiry at its own time", () => {
    const late = template({ day: 2, timingValue: 960 });
    expect(planOpen("A", [late], "2026-10-20 15:00").map((item) => localTime(item.sendAt))).toEqual([
      "2026-10-21T16:00",
    ]);
  });

  it("sends only the earliest deferred reminder and never the others", () => {
    const second = template({ day: 2, timingValue: 600, position: 1 });
    const first = template({ day: 2, timingValue: 600, position: 0 });
    const third = template({ day: 2, timingValue: 720 });
    const late = template({ day: 2, timingValue: 960 });
    const plan = planOpen("A", [late, third, second, first], "2026-10-20 15:00");
    expect(plan.map((item) => [item.template, localTime(item.sendAt)])).toEqual([
      [first, "2026-10-21T15:00"],
      [late, "2026-10-21T16:00"],
    ]);
    const sent = new Set([first.id]);
    expect(pickNext(plan, none, T("2026-10-21 15:00"), unused)?.template).toBe(first);
    for (const minute of ["15:01", "15:02", "15:30", "15:59"]) {
      expect(pickNext(plan, sent, T(`2026-10-21 ${minute}`), unused)).toBeNull();
    }
    expect(pickNext(plan, sent, T("2026-10-21 16:00"), unused)?.template).toBe(late);
  });

  it("chooses the same deferred reminder whatever has been sent", () => {
    const first = template({ day: 2, timingValue: 600 });
    const second = template({ day: 2, timingValue: 660 });
    const plan = planOpen("A", [second, first], "2026-10-20 15:00");
    expect(plan.map((item) => item.template)).toEqual([first]);
    expect(nextPendingDue(plan, new Set([first.id]), T("2026-10-21 15:01"))).toBeNull();
  });

  it("lets the next deferred reminder stand in when the first is gone", () => {
    const second = template({ day: 2, timingValue: 660 });
    const third = template({ day: 2, timingValue: 720 });
    expect(planOpen("A", [third, second], "2026-10-20 15:00").map((item) => item.template)).toEqual([second]);
  });

  it("drops deferred reminders when the link outlives day 7", () => {
    const deferred = template({ day: 2, timingValue: 600 });
    const lastDay = template({ day: 7, timingValue: 1380 });
    const plan = planChain(
      segmentChainInput([deferred, lastDay], {
        segment: "A",
        enteredAt: T("2026-10-20 15:00"),
        linkExpiresAt: T("2026-10-27 00:00"),
      }),
    );
    expect(plan).toEqual([]);
  });

  it("leaves day 1 unchanged", () => {
    const open = template({ day: 1, timingValue: 60 });
    const closed = template({ day: 1, timingValue: 1500 });
    expect(planOpen("A", [open, closed], "2026-10-20 15:00").map((item) => [item.template, localTime(item.sendAt)])).toEqual([
      [open, "2026-10-20T16:00"],
    ]);
  });

  it("leaves C unchanged", () => {
    const progrev = template({ day: 2, timingValue: 600 });
    expect(planOpen("C", [progrev], "2026-10-20 15:00").map((item) => localTime(item.sendAt))).toEqual([
      "2026-10-21T10:00",
    ]);
  });
});
