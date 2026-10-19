import { describe, expect, it } from "vitest";
import { funnelStatuses, type FunnelStatus } from "@funnel/shared";
import { endReasonFor, segmentFor, statusFor } from "./status";

type Marks = { duration: number; introEndSec: number | null; courseStartSec: number | null; priceSec: number | null };

const registered = { registeredAt: new Date(1), wroteAdminAt: null as Date | null };
const fullMarks: Marks = { duration: 1000, introEndSec: 100, courseStartSec: 700, priceSec: 900 };
const noMarks: Marks = { duration: 1000, introEndSec: null, courseStartSec: null, priceSec: null };

function progress(maxPosition: number, started = true) {
  return { maxPosition, startedAt: started ? new Date(2) : null };
}

describe("statusFor", () => {
  it("is null for an unregistered user", () => {
    expect(statusFor(progress(500), fullMarks, { registeredAt: null, wroteAdminAt: null })).toBeNull();
  });

  it("is adminga_yozdi once the user wrote to admin, even past the price mark", () => {
    const user = { registeredAt: new Date(1), wroteAdminAt: new Date(3) };
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

  it("splits korishni_boshladi and dars_yarmida exactly at the lesson start mark", () => {
    expect(statusFor(progress(99), fullMarks, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(100), fullMarks, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(699), fullMarks, registered)).toBe("dars_yarmida");
  });

  it("uses each video's own marks for the TZ 5:00, 15:00 and 18:22 boundaries", () => {
    const tz: Marks = { duration: 1500, introEndSec: 300, courseStartSec: 900, priceSec: 1102 };
    expect(statusFor(progress(299), tz, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(300), tz, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(899), tz, registered)).toBe("dars_yarmida");
    expect(statusFor(progress(900), tz, registered)).toBe("sotuvda_toxtadi");
    expect(statusFor(progress(1101), tz, registered)).toBe("sotuvda_toxtadi");
    expect(statusFor(progress(1102), tz, registered)).toBe("narxni_kurdi");
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

  it("uses the lesson start mark even when the course start is missing", () => {
    const marks = { ...noMarks, introEndSec: 200, priceSec: 800 };
    expect(statusFor(progress(199), marks, registered)).toBe("korishni_boshladi");
    expect(statusFor(progress(200), marks, registered)).toBe("dars_yarmida");
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

  it("moves A and B to the second chance once the link expires, and out of the funnel once offers are used up", () => {
    expect(segmentFor("link_berildi", "expired")).toBe("D");
    expect(segmentFor("dars_yarmida", "expired")).toBe("D");
    expect(segmentFor("link_berildi", "exhausted")).toBeNull();
    expect(segmentFor("sotuvda_toxtadi", "exhausted")).toBeNull();
  });

  it("keeps C regardless of the link", () => {
    expect(segmentFor("narxni_kurdi", "expired")).toBe("C");
    expect(segmentFor("narxni_kurdi", "exhausted")).toBe("C");
    expect(segmentFor("adminga_yozdi", "expired")).toBeNull();
  });
});

describe("endReasonFor", () => {
  const user = { botBlocked: false, wroteAdmin: false };

  it("names each transition", () => {
    expect(endReasonFor("A", "B", user)).toBe("advanced");
    expect(endReasonFor("A", "D", user)).toBe("expired");
    expect(endReasonFor("B", "D", user)).toBe("expired");
    expect(endReasonFor("D", "A", user)).toBe("relinked");
    expect(endReasonFor("D", "B", user)).toBe("relinked");
    expect(endReasonFor("A", "A", user)).toBe("relinked");
    expect(endReasonFor("D", null, user)).toBe("offers_exhausted");
    expect(endReasonFor("D", null, { botBlocked: false, wroteAdmin: true })).toBe("wrote_admin");
    expect(endReasonFor("A", null, { botBlocked: true, wroteAdmin: true })).toBe("bot_blocked");
  });
});
