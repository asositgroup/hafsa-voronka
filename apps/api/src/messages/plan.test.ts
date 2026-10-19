import { describe, expect, it } from "vitest";
import { variableValues } from "@funnel/shared";
import {
  DAILY_CAP,
  GRACE_MS,
  isNightAt,
  linkExpiryFor,
  nextPendingDue,
  pickNext,
  planChain,
  type PlanInput,
  type PlanItem,
  planKey,
  previewChain,
  type ScheduleTemplate,
  type SkippedItem,
  tashkentDayStart,
} from "./plan";

const local = (value: string) => new Date(`${value}+05:00`);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

let nextId = 1;

function template(overrides: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
  return { id: nextId++, day: 1, position: 0, timingType: "after_entry", timingValue: 60, ...overrides };
}

function beforeExpiry(hours: number, position = 0): ScheduleTemplate {
  return template({ timingType: "before_expiry", timingValue: hours * 60, position });
}

const nightNoticeTemplate = () => template({ timingType: "night_notice", timingValue: 0 });

const TZ_HOURS = [23, 21, 19, 17, 15, 10, 5, 4, 3, 2, 1];

function segmentAInput(givenAt: string, hours = TZ_HOURS, ttlHours = 24): PlanInput {
  const anchorAt = local(givenAt);
  return {
    templates: hours.map((value, index) => beforeExpiry(value, index)),
    anchorAt,
    linkExpiresAt: linkExpiryFor(anchorAt, ttlHours),
    linkBound: true,
    nightNotice: nightNoticeTemplate(),
  };
}

function localTime(date: Date) {
  return new Date(date.getTime() + 5 * HOUR).toISOString().slice(0, 16);
}

function label(item: PlanItem | SkippedItem) {
  if ("kind" in item && item.kind === "night_notice") return "notice";
  if (item.template.timingType === "before_expiry") return `${item.template.timingValue / 60}h`;
  return `+${item.template.timingValue}`;
}

function table(input: PlanInput) {
  return planChain(input).map((item) => {
    const values = variableValues({
      name: null,
      firstName: null,
      lastPositionSec: 0,
      durationSec: null,
      linkExpiresAt: input.linkExpiresAt,
      now: item.sendAt,
    });
    return [label(item), localTime(item.sendAt), item.kind === "night_notice" ? values.link_tugash_soati : values.qolgan_vaqt];
  });
}

function times(input: PlanInput) {
  return planChain(input).map((item) => [label(item), localTime(item.sendAt), item.kind]);
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

describe("planChain: TZ 1.1 example table", () => {
  it("link given at 10:00", () => {
    const input = segmentAInput("2026-10-19T10:00");
    expect(input.linkExpiresAt).toEqual(local("2026-10-20T10:00"));
    expect(table(input)).toEqual([
      ["23h", "2026-10-19T11:00", "23 soat"],
      ["21h", "2026-10-19T13:00", "21 soat"],
      ["19h", "2026-10-19T15:00", "19 soat"],
      ["17h", "2026-10-19T17:00", "17 soat"],
      ["15h", "2026-10-19T19:00", "15 soat"],
      ["notice", "2026-10-19T22:00", "10:00"],
      ["3h", "2026-10-20T07:00", "3 soat"],
      ["2h", "2026-10-20T08:00", "2 soat"],
      ["1h", "2026-10-20T09:00", "1 soat"],
    ]);
  });

  it("link given at 22:30", () => {
    const input = segmentAInput("2026-10-19T22:30");
    expect(input.linkExpiresAt).toEqual(local("2026-10-20T22:30"));
    expect(table(input)).toEqual([
      ["15h", "2026-10-20T07:30", "15 soat"],
      ["10h", "2026-10-20T12:30", "10 soat"],
      ["5h", "2026-10-20T17:30", "5 soat"],
      ["4h", "2026-10-20T18:30", "4 soat"],
      ["3h", "2026-10-20T19:30", "3 soat"],
      ["2h", "2026-10-20T20:30", "2 soat"],
      ["1h", "2026-10-20T21:30", "1 soat"],
    ]);
  });

  it("link given at 02:00", () => {
    const input = segmentAInput("2026-10-19T02:00");
    expect(input.linkExpiresAt).toEqual(local("2026-10-20T09:00"));
    expect(table(input)).toEqual([
      ["23h", "2026-10-19T10:00", "23 soat"],
      ["21h", "2026-10-19T12:00", "21 soat"],
      ["19h", "2026-10-19T14:00", "19 soat"],
      ["17h", "2026-10-19T16:00", "17 soat"],
      ["15h", "2026-10-19T18:00", "15 soat"],
      ["notice", "2026-10-19T22:00", "09:00"],
      ["2h", "2026-10-20T07:00", "2 soat"],
      ["1h", "2026-10-20T08:00", "1 soat"],
    ]);
  });

  it("explains the swallowed and dropped reminders of the 10:00 row", () => {
    const preview = previewChain(segmentAInput("2026-10-19T10:00"));
    expect(preview.skipped.map((item) => [label(item), localTime(item.rawAt), item.reason])).toEqual([
      ["10h", "2026-10-20T00:00", "swallowed"],
      ["5h", "2026-10-20T05:00", "swallowed"],
      ["4h", "2026-10-20T06:00", "dropped"],
    ]);
  });

  it("gives the night notice the morning date as its slot", () => {
    const notice = planChain(segmentAInput("2026-10-19T10:00")).find((item) => item.kind === "night_notice");
    expect(notice?.slot).toBe("2026-10-20");
    expect(planChain(segmentAInput("2026-10-19T10:00")).filter((item) => item.kind !== "night_notice").every((item) => item.slot === "")).toBe(true);
  });
});

describe("planChain: link given 07:00 to 07:29", () => {
  it.each(["07:00", "07:10", "07:29"])("drops the morning collapse that would land after the %s expiry", (time) => {
    const input = segmentAInput(`2026-10-19T${time}`);
    expect(input.linkExpiresAt).toEqual(local(`2026-10-20T${time}`));
    const plan = planChain(input);
    expect(plan.some((item) => item.sendAt.getTime() >= local("2026-10-20T00:00").getTime())).toBe(false);
    expect(plan.at(-1)).toMatchObject({ kind: "night_notice", sendAt: local("2026-10-19T22:00") });
  });

  it("keeps the 07:10 row in the day", () => {
    expect(times(segmentAInput("2026-10-19T07:10"))).toEqual([
      ["23h", "2026-10-19T08:10", "regular"],
      ["21h", "2026-10-19T10:10", "regular"],
      ["19h", "2026-10-19T12:10", "regular"],
      ["17h", "2026-10-19T14:10", "regular"],
      ["15h", "2026-10-19T16:10", "regular"],
      ["10h", "2026-10-19T21:10", "regular"],
      ["notice", "2026-10-19T22:00", "night_notice"],
    ]);
  });

  it("does not stretch the night to 07:30 for a link given in the morning", () => {
    const input: PlanInput = {
      templates: [template({ timingValue: 5 })],
      anchorAt: local("2026-10-19T07:10"),
      linkExpiresAt: null,
      linkBound: false,
      nightNotice: null,
    };
    expect(times(input)).toEqual([["+5", "2026-10-19T07:15", "regular"]]);
  });
});

describe("planChain: night edges", () => {
  const plain = (value: number): PlanInput => ({
    templates: [template({ timingValue: value })],
    anchorAt: local("2026-10-19T10:00"),
    linkExpiresAt: null,
    linkBound: false,
    nightNotice: null,
  });

  it("sends at 22:59 as planned", () => {
    expect(times(plain(779))).toEqual([["+779", "2026-10-19T22:59", "regular"]]);
  });

  it("collapses 23:00 into 07:30", () => {
    expect(times(plain(780))).toEqual([["+780", "2026-10-20T07:30", "collapsed"]]);
  });

  it("collapses 06:59 into 07:30", () => {
    expect(times(plain(1259))).toEqual([["+1259", "2026-10-20T07:30", "collapsed"]]);
  });

  it("sends at 07:00 as planned", () => {
    expect(times(plain(1260))).toEqual([["+1260", "2026-10-20T07:00", "regular"]]);
  });
});

describe("planChain: rule 3, the most urgent reminder survives", () => {
  it("collapses the reminder with the least time left", () => {
    const input = segmentAInput("2026-10-19T12:00", [10, 8, 6]);
    expect(times(input)).toEqual([
      ["notice", "2026-10-19T22:00", "night_notice"],
      ["6h", "2026-10-20T07:30", "collapsed"],
    ]);
  });

  it("breaks a tie by position, then id", () => {
    const first = template({ timingValue: 800, position: 0 });
    const second = template({ timingValue: 800, position: 1 });
    const plan = planChain({
      templates: [second, first],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: null,
      linkBound: false,
      nightNotice: null,
    });
    expect(plan.map((item) => item.template.id)).toEqual([second.id]);
  });
});

describe("planChain: rule 4, one hour apart", () => {
  const withDayItem = (dayValue: number): PlanInput => ({
    templates: [template({ timingValue: 780 }), template({ day: 1, timingValue: dayValue })],
    anchorAt: local("2026-10-19T10:00"),
    linkExpiresAt: null,
    linkBound: false,
    nightNotice: null,
  });

  it("keeps the collapse when the next reminder is exactly an hour later", () => {
    expect(times(withDayItem(1350))).toEqual([
      ["+780", "2026-10-20T07:30", "collapsed"],
      ["+1350", "2026-10-20T08:30", "regular"],
    ]);
  });

  it("drops the collapse when the next reminder is less than an hour later", () => {
    expect(times(withDayItem(1349))).toEqual([["+1349", "2026-10-20T08:29", "regular"]]);
  });

  it("drops the collapse when a reminder is due earlier that morning", () => {
    expect(times(withDayItem(1260))).toEqual([["+1260", "2026-10-20T07:00", "regular"]]);
  });

  it("keeps the collapse when the closest reminder was the evening before", () => {
    expect(times(withDayItem(770))).toEqual([
      ["+770", "2026-10-19T22:50", "regular"],
      ["+780", "2026-10-20T07:30", "collapsed"],
    ]);
  });
});

describe("planChain: rule 5, the 22:00 notice", () => {
  it("is not sent when the night swallows exactly one reminder", () => {
    expect(times(segmentAInput("2026-10-19T12:00", [10, 3]))).toEqual([
      ["10h", "2026-10-20T07:30", "collapsed"],
      ["3h", "2026-10-20T09:00", "regular"],
    ]);
  });

  it("is sent when the night swallows two reminders", () => {
    expect(times(segmentAInput("2026-10-19T12:00", [10, 8, 3]))).toEqual([
      ["notice", "2026-10-19T22:00", "night_notice"],
      ["8h", "2026-10-20T07:30", "collapsed"],
      ["3h", "2026-10-20T09:00", "regular"],
    ]);
  });

  it("is not sent without a notice template", () => {
    const input = { ...segmentAInput("2026-10-19T12:00", [10, 8, 3]), nightNotice: null };
    expect(planChain(input).some((item) => item.kind === "night_notice")).toBe(false);
  });

  it("is not sent for a run that is not tied to a link", () => {
    const input = { ...segmentAInput("2026-10-19T12:00", [10, 8, 3]), linkBound: false };
    expect(planChain(input).some((item) => item.kind === "night_notice")).toBe(false);
  });

  it("is not sent when the link outlives the next morning", () => {
    expect(times(segmentAInput("2026-10-19T12:00", [34, 32], 48))).toEqual([
      ["32h", "2026-10-20T07:30", "collapsed"],
    ]);
  });

  it("is not sent when 22:00 is before the run started", () => {
    expect(times(segmentAInput("2026-10-19T22:10", [23, 20, 1]))).toEqual([
      ["20h", "2026-10-20T07:30", "collapsed"],
      ["1h", "2026-10-20T21:10", "regular"],
    ]);
  });

  it("is sent at exactly 22:00 when the run started then", () => {
    expect(times(segmentAInput("2026-10-19T22:00", [23, 22, 1]))).toEqual([
      ["notice", "2026-10-19T22:00", "night_notice"],
      ["22h", "2026-10-20T07:30", "collapsed"],
      ["1h", "2026-10-20T21:00", "regular"],
    ]);
  });
});

describe("planChain: rule 6, a run that starts at night", () => {
  const night = (...values: number[]): PlanInput => ({
    templates: values.map((value, position) => template({ timingValue: value, position })),
    anchorAt: local("2026-10-19T02:00"),
    linkExpiresAt: null,
    linkBound: false,
    nightNotice: null,
  });

  it("sends the first reminder at 07:30", () => {
    expect(times(night(60))).toEqual([["+60", "2026-10-19T07:30", "collapsed"]]);
  });

  it("holds a 07:15 reminder until 07:30", () => {
    expect(times(night(315))).toEqual([["+315", "2026-10-19T07:30", "collapsed"]]);
  });

  it("sends a 07:30 reminder as planned", () => {
    expect(times(night(330))).toEqual([["+330", "2026-10-19T07:30", "regular"]]);
  });

  it("drops the collapse when a reminder follows at 08:00", () => {
    expect(times(night(60, 360))).toEqual([["+360", "2026-10-19T08:00", "regular"]]);
  });

  it("applies to the first night only and puts the notice before the second", () => {
    const input = segmentAInput("2026-10-19T23:30", [33, 26, 20, 10, 5, 1]);
    expect(input.linkExpiresAt).toEqual(local("2026-10-21T09:00"));
    expect(times(input)).toEqual([
      ["26h", "2026-10-20T07:30", "collapsed"],
      ["20h", "2026-10-20T13:00", "regular"],
      ["notice", "2026-10-20T22:00", "night_notice"],
      ["1h", "2026-10-21T08:00", "regular"],
    ]);
    expect(planChain(input).find((item) => item.kind === "night_notice")?.slot).toBe("2026-10-21");
  });
});

describe("planChain: after-entry and day timings", () => {
  it("collapses an after-entry reminder that falls at night in segment A", () => {
    const input: PlanInput = {
      templates: [template({ timingValue: 14 * 60 }), beforeExpiry(1)],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: local("2026-10-20T10:00"),
      linkBound: true,
      nightNotice: nightNoticeTemplate(),
    };
    expect(times(input)).toEqual([
      ["+840", "2026-10-20T07:30", "collapsed"],
      ["1h", "2026-10-20T09:00", "regular"],
    ]);
  });

  it("drops an after-entry reminder at or after the expiry of a linked run", () => {
    const input: PlanInput = {
      templates: [template({ timingValue: 120 }), template({ timingValue: 180 })],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: local("2026-10-19T13:00"),
      linkBound: true,
      nightNotice: null,
    };
    expect(times(input)).toEqual([["+120", "2026-10-19T12:00", "regular"]]);
  });

  it("keeps after-entry reminders past the expiry for segment C", () => {
    const input: PlanInput = {
      templates: [template({ timingValue: 120 }), template({ timingValue: 180 })],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: local("2026-10-19T11:00"),
      linkBound: false,
      nightNotice: null,
    };
    expect(times(input)).toEqual([
      ["+120", "2026-10-19T12:00", "regular"],
      ["+180", "2026-10-19T13:00", "regular"],
    ]);
  });

  it("schedules day_time on the anchor day and drops one that already passed", () => {
    const input: PlanInput = {
      templates: [
        template({ timingType: "day_time", timingValue: 540 }),
        template({ timingType: "day_time", timingValue: 720 }),
        template({ timingType: "day_time", day: 2, timingValue: 540 }),
      ],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: null,
      linkBound: false,
      nightNotice: null,
    };
    expect(planChain(input).map((item) => localTime(item.sendAt))).toEqual(["2026-10-19T12:00", "2026-10-20T09:00"]);
  });

  it("drops before-expiry reminders that fall before the anchor or without a link", () => {
    const input = segmentAInput("2026-10-19T10:00", [30, 23]);
    expect(times(input)).toEqual([["23h", "2026-10-19T11:00", "regular"]]);
    expect(planChain({ ...input, linkExpiresAt: null })).toEqual([]);
  });

  it("drops anything at or after seven days from the anchor", () => {
    const input: PlanInput = {
      templates: [template({ timingValue: 7 * 1440 - 1 }), template({ timingValue: 7 * 1440 })],
      anchorAt: local("2026-10-19T10:00"),
      linkExpiresAt: null,
      linkBound: false,
      nightNotice: null,
    };
    expect(planChain(input).map((item) => localTime(item.sendAt))).toEqual(["2026-10-26T09:59"]);
  });

  it("ignores night notice templates mixed into the regular list", () => {
    const input = segmentAInput("2026-10-19T12:00", [3]);
    expect(planChain({ ...input, templates: [...input.templates, nightNoticeTemplate()] }).map(label)).toEqual(["3h"]);
  });
});

describe("pickNext and nextPendingDue", () => {
  const input = segmentAInput("2026-10-19T10:00");
  const plan = planChain(input);
  const none = new Set<string>();

  it("returns the item that is due", () => {
    expect(pickNext(plan, none, local("2026-10-19T11:00"), 0)).toBe(plan[0]);
    expect(pickNext(plan, none, local("2026-10-19T10:59"), 0)).toBeNull();
  });

  it("skips sent items without changing the plan", () => {
    const sent = new Set([planKey(plan[0])]);
    expect(planChain(input)).toEqual(plan);
    expect(pickNext(plan, sent, local("2026-10-19T11:30"), 0)).toBeNull();
    expect(pickNext(plan, sent, local("2026-10-19T13:00"), 0)).toBe(plan[1]);
  });

  it("gives up after the grace period", () => {
    expect(pickNext(plan, none, new Date(plan[0].sendAt.getTime() + GRACE_MS), 0)).toBe(plan[0]);
    expect(pickNext(plan, none, new Date(plan[0].sendAt.getTime() + GRACE_MS + 1), 0)).toBeNull();
  });

  it("stays silent at night and at the daily cap", () => {
    const late = template({ timingValue: 779 });
    const nightPlan = planChain({ templates: [late], anchorAt: local("2026-10-19T10:00"), linkExpiresAt: null, linkBound: false, nightNotice: null });
    expect(pickNext(nightPlan, none, local("2026-10-19T23:00"), 0)).toBeNull();
    expect(pickNext(plan, none, local("2026-10-19T11:00"), DAILY_CAP)).toBeNull();
  });

  it("keys the night notice by its slot", () => {
    const notice = plan.find((item) => item.kind === "night_notice")!;
    expect(planKey(notice)).toBe(`${notice.template.id}:2026-10-20`);
    expect(planKey(plan[0])).toBe(`${plan[0].template.id}:`);
  });

  it("finds the next pending send", () => {
    expect(nextPendingDue(plan, none, local("2026-10-19T10:00"))).toEqual(local("2026-10-19T11:00"));
    expect(nextPendingDue(plan, new Set(plan.slice(0, 5).map(planKey)), local("2026-10-19T19:30"))).toEqual(
      local("2026-10-19T22:00"),
    );
    expect(nextPendingDue(plan, new Set(plan.map(planKey)), local("2026-10-19T10:00"))).toBeNull();
  });
});
