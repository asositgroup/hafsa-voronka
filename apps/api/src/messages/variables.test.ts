import { describe, expect, it } from "vitest";
import { SAMPLE_CONTEXT, type TemplateContext, variableValues } from "@funnel/shared";

const now = new Date("2026-10-19T08:00:00Z");

function context(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    name: "Aziza",
    firstName: "Az",
    lastPositionSec: 0,
    durationSec: 1000,
    linkExpiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    now,
    ...overrides,
  };
}

function remaining(ms: number) {
  return variableValues(context({ linkExpiresAt: new Date(now.getTime() + ms) })).qolgan_vaqt;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("variableValues", () => {
  it("formats the remaining time with the two largest units", () => {
    expect(remaining(2 * DAY + 5 * HOUR + 20 * MINUTE)).toBe("2 kun 5 soat");
    expect(remaining(5 * HOUR + 20 * MINUTE)).toBe("5 soat 20 daqiqa");
    expect(remaining(20 * MINUTE)).toBe("20 daqiqa");
    expect(remaining(1 * DAY)).toBe("1 kun");
    expect(remaining(3 * HOUR)).toBe("3 soat");
  });

  it("shows zero minutes when expired or without expiry", () => {
    expect(remaining(-5 * MINUTE)).toBe("0 daqiqa");
    expect(remaining(0)).toBe("0 daqiqa");
    expect(variableValues(context({ linkExpiresAt: null })).qolgan_vaqt).toBe("0 daqiqa");
  });

  it("falls back from name to first name to the default", () => {
    expect(variableValues(context()).ism).toBe("Aziza");
    expect(variableValues(context({ name: null })).ism).toBe("Az");
    expect(variableValues(context({ name: "  ", firstName: null })).ism).toBe("Foydalanuvchi");
    expect(variableValues(context({ name: "x".repeat(80) })).ism).toHaveLength(64);
  });

  it("formats the stopped position as MM:SS or H:MM:SS", () => {
    expect(variableValues(context({ lastPositionSec: 754.9 })).toxtagan_joy).toBe("12:34");
    expect(variableValues(context({ lastPositionSec: 3599 })).toxtagan_joy).toBe("59:59");
    expect(variableValues(context({ lastPositionSec: 3600 })).toxtagan_joy).toBe("1:00:00");
    expect(variableValues(context({ lastPositionSec: 3725 })).toxtagan_joy).toBe("1:02:05");
  });

  it("rounds the minutes left up and clamps at zero", () => {
    expect(variableValues(context({ lastPositionSec: 700, durationSec: 1000 })).qolgan_daqiqa).toBe("5");
    expect(variableValues(context({ lastPositionSec: 940, durationSec: 1000 })).qolgan_daqiqa).toBe("1");
    expect(variableValues(context({ lastPositionSec: 1200, durationSec: 1000 })).qolgan_daqiqa).toBe("0");
    expect(variableValues(context({ durationSec: null })).qolgan_daqiqa).toBe("");
  });

  it("formats the expiry in Tashkent time across UTC midnight", () => {
    const evening = variableValues(context({ linkExpiresAt: new Date("2026-10-20T19:30:00Z") }));
    expect(evening.link_tugash_vaqti).toBe("21-oktabr, 00:30");
    expect(variableValues(SAMPLE_CONTEXT).link_tugash_vaqti).toBe("21-oktabr, 18:30");
    expect(variableValues(context({ linkExpiresAt: new Date("2026-12-31T19:00:00Z") })).link_tugash_vaqti).toBe(
      "1-yanvar, 00:00",
    );
    expect(variableValues(context({ linkExpiresAt: null })).link_tugash_vaqti).toBe("");
  });
});
