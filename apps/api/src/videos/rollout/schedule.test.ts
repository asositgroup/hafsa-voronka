import { describe, expect, it } from "vitest";
import { isInRolloutWindow, rolloutCreateSchema, rolloutFilterSchema, validateRolloutSchedule } from "@funnel/shared";

const tashkent = (hour: number, minute = 0) => new Date(Date.UTC(2027, 2, 10, hour - 5, minute));

describe("Rollout schedule", () => {
  it("treats 07:00 through 22:00 Tashkent time as the send window", () => {
    expect(isInRolloutWindow(tashkent(6, 59))).toBe(false);
    expect(isInRolloutWindow(tashkent(7, 0))).toBe(true);
    expect(isInRolloutWindow(tashkent(14, 30))).toBe(true);
    expect(isInRolloutWindow(tashkent(22, 0))).toBe(true);
    expect(isInRolloutWindow(tashkent(22, 1))).toBe(false);
    expect(isInRolloutWindow(tashkent(3, 0))).toBe(false);
  });

  it("accepts sending now at any hour", () => {
    expect(validateRolloutSchedule(null, tashkent(23, 30))).toBeNull();
  });

  it("rejects a time that is not in the future", () => {
    const now = tashkent(10);
    expect(validateRolloutSchedule(now, now)).toBe("past");
    expect(validateRolloutSchedule(tashkent(9), now)).toBe("past");
  });

  it("rejects a future time outside the window", () => {
    const now = tashkent(10);
    expect(validateRolloutSchedule(tashkent(23), now)).toBe("outside_window");
    expect(validateRolloutSchedule(new Date(tashkent(5).getTime() + 86_400_000), now)).toBe("outside_window");
    expect(validateRolloutSchedule(tashkent(21, 45), now)).toBeNull();
  });

  it("validates the filter and create bodies", () => {
    expect(rolloutFilterSchema.safeParse({ audiences: ["not_opened"], sinceDays: null }).success).toBe(true);
    expect(rolloutFilterSchema.safeParse({ audiences: [], sinceDays: null }).success).toBe(false);
    expect(rolloutFilterSchema.safeParse({ audiences: ["halfway", "halfway"], sinceDays: null }).success).toBe(false);
    expect(rolloutFilterSchema.safeParse({ audiences: ["nobody"], sinceDays: null }).success).toBe(false);
    expect(rolloutFilterSchema.safeParse({ audiences: ["bought"], sinceDays: 0 }).success).toBe(false);
    expect(
      rolloutCreateSchema.safeParse({ audiences: ["bought"], sinceDays: 30, scheduledAt: "2027-03-10T05:00:00.000Z" })
        .success,
    ).toBe(true);
    expect(rolloutCreateSchema.safeParse({ audiences: ["bought"], sinceDays: 30, scheduledAt: "tomorrow" }).success).toBe(
      false,
    );
  });
});
