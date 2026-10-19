import { describe, expect, it } from "vitest";
import { funnelStatuses, type FunnelStatus } from "@funnel/shared";
import { segmentFor, statusFor } from "./status";

type Marks = { duration: number; introEndSec: number | null; courseStartSec: number | null; priceSec: number | null };

const registered = { registeredAt: new Date(1), channelClickAt: null as Date | null };
const fullMarks: Marks = { duration: 1000, introEndSec: 100, courseStartSec: 700, priceSec: 900 };
const noMarks: Marks = { duration: 1000, introEndSec: null, courseStartSec: null, priceSec: null };

function progress(maxPosition: number, started = true) {
  return { maxPosition, startedAt: started ? new Date(2) : null };
}

describe("statusFor", () => {
  it("is null for an unregistered user", () => {
    expect(statusFor(progress(500), fullMarks, { registeredAt: null, channelClickAt: null })).toBeNull();
  });

  it("is adminga_yozdi once the user wrote to admin, even past the price mark", () => {
    const user = { registeredAt: new Date(1), channelClickAt: new Date(3) };
    expect(statusFor(progress(950), fullMarks, user)).toBe("adminga_yozdi");
    expect(statusFor(undefined, fullMarks, user)).toBe("adminga_yozdi");
  });

  it("is link_berildi without progress or before any play", () => {
    expect(statusFor(undefined, fullMarks, registered)).toBe("link_berildi");
    expect(statusFor(progress(0, false), fullMarks, registered)).toBe("link_berildi");
  });

  it("is korishni_boshladi once played, even at position 0", () => {
    expect(statusFor(progress(0), fullMarks, registered)).toBe("korishni_boshladi");
  });

  it("splits korishni_boshladi and dars_yarmida at exactly the lesson midpoint", () => {
    expect(statusFor(progress(399), fullMarks, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(400), fullMarks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(699), fullMarks, registered)).toBe("dars_yarmida");
  });

  it("switches to sotuvda_toxtadi exactly at the course start mark", () => {
    expect(statusFor(progress(700), fullMarks, registered)).toBe("sotuvda_toxtadi");
    expect(statusFor(progress(899), fullMarks, registered)).toBe("sotuvda_toxtadi");
  });

  it("switches to narxni_kurdi exactly at the price mark", () => {
    expect(statusFor(progress(900), fullMarks, registered)).toBe("narxni_kurdi");
    expect(statusFor(progress(1000), fullMarks, registered)).toBe("narxni_kurdi");
  });

  it("stays in dars_yarmida when no marks are set", () => {
    expect(statusFor(progress(500), noMarks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(1000), noMarks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(499), noMarks, registered)).toBe("korishni_boshladi");
  });

  it("uses the price mark as lesson end when only the price is set", () => {
    const marks = { ...noMarks, priceSec: 600 };
    expect(statusFor(progress(299), marks, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(300), marks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(599), marks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(600), marks, registered)).toBe("narxni_kurdi");
  });

  it("offsets the midpoint by the intro end", () => {
    const marks = { ...noMarks, introEndSec: 200, courseStartSec: 800 };
    expect(statusFor(progress(499), marks, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(500), marks, registered)).toBe("dars_yarmida");
  });
});

describe("segmentFor", () => {
  it("maps every status", () => {
    const expected: Record<FunnelStatus, "A" | "B" | "C" | null> = {
      link_berildi: "A",
      korishni_boshladi: "B",
      dars_yarmida: "B",
      sotuvda_toxtadi: "B",
      narxni_kurdi: "C",
      adminga_yozdi: null,
    };
    for (const status of funnelStatuses) expect(segmentFor(status)).toBe(expected[status]);
    expect(segmentFor(null)).toBeNull();
  });
});
