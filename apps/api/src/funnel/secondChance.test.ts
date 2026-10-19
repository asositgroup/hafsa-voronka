import { describe, expect, it } from "vitest";
import {
  linkStateFor,
  nextOffer,
  type OfferRecord,
  offerDueStamp,
  pickOfferTemplate,
} from "./secondChance";

const local = (value: string) => new Date(`${value}+05:00`);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function offer(occasion: number, dueAt: Date, answer: OfferRecord["answer"] = null): OfferRecord {
  return { occasion, dueAt, answer };
}

function ignoredChain(first: Date, count: number): OfferRecord[] {
  return Array.from({ length: count }, (_, index) => offer(index + 1, new Date(first.getTime() + index * DAY)));
}

describe("nextOffer", () => {
  const expiry = local("2026-10-20T10:00:00");

  it("is live while the link is open or has no expiry", () => {
    expect(nextOffer({ history: [], expiresAt: local("2026-10-20T10:00:00") }, local("2026-10-20T09:59:00"))).toEqual({
      kind: "live",
    });
    expect(nextOffer({ history: [], expiresAt: null }, local("2026-10-25T10:00:00"))).toEqual({ kind: "live" });
  });

  it("offers occasion 1 at the expiry that opened the second chance", () => {
    expect(nextOffer({ history: [], expiresAt: expiry }, expiry)).toEqual({ kind: "due", occasion: 1, dueAt: expiry });
  });

  it("moves an expiry at night to 07:30 the next morning", () => {
    const night = local("2026-10-20T23:40:00");
    expect(nextOffer({ history: [], expiresAt: night }, night)).toEqual({
      kind: "due",
      occasion: 1,
      dueAt: local("2026-10-21T07:30:00"),
    });
  });

  it("offers the next occasion 24h after an unanswered one", () => {
    const step = nextOffer({ history: [offer(1, expiry)], expiresAt: expiry }, local("2026-10-20T12:00:00"));
    expect(step).toEqual({ kind: "due", occasion: 2, dueAt: local("2026-10-21T10:00:00") });
  });

  it("treats a «Keyinroq» answer like silence until the time picker ships", () => {
    const step = nextOffer({ history: [offer(1, expiry, "later")], expiresAt: expiry }, local("2026-10-20T12:00:00"));
    expect(step).toEqual({ kind: "due", occasion: 2, dueAt: local("2026-10-21T10:00:00") });
  });

  it("waits while an appointment is pending", () => {
    const step = nextOffer(
      { history: [offer(1, expiry, "later")], expiresAt: expiry, pendingAppointment: true },
      local("2026-10-22T12:00:00"),
    );
    expect(step).toEqual({ kind: "wait" });
  });

  it("after «Ha» the next occasion is due when the granted link expires", () => {
    const granted = local("2026-10-21T11:15:00");
    const history = [offer(1, expiry, "again")];
    expect(nextOffer({ history, expiresAt: granted }, local("2026-10-21T11:00:00"))).toEqual({ kind: "live" });
    expect(nextOffer({ history, expiresAt: granted }, granted)).toEqual({ kind: "due", occasion: 2, dueAt: granted });
  });

  it("never sends two offers on one Tashkent day", () => {
    const shortLink = local("2026-10-20T15:00:00");
    const history = [offer(1, local("2026-10-20T10:00:00"), "again")];
    expect(nextOffer({ history, expiresAt: shortLink }, shortLink)).toEqual({
      kind: "due",
      occasion: 2,
      dueAt: local("2026-10-21T07:30:00"),
    });
  });

  it("moves an unanswered follow-up that lands at night to 07:30", () => {
    const late = local("2026-10-20T22:30:00");
    const step = nextOffer({ history: [offer(1, late)], expiresAt: late }, late);
    expect(step).toEqual({ kind: "due", occasion: 2, dueAt: local("2026-10-21T22:30:00") });
    const night = local("2026-10-20T23:10:00");
    expect(nextOffer({ history: [offer(1, night)], expiresAt: night }, night)).toEqual({
      kind: "due",
      occasion: 2,
      dueAt: local("2026-10-22T07:30:00"),
    });
  });

  it("is used up after the seventh occasion, once the next one would have been due", () => {
    const history = ignoredChain(expiry, 7);
    const lastDue = history[6].dueAt;
    expect(nextOffer({ history, expiresAt: expiry }, lastDue)).toEqual({
      kind: "exhausted",
      at: new Date(lastDue.getTime() + DAY),
    });
  });

  it("is used up seven days after the first offer even with occasions left", () => {
    const history = [offer(1, expiry, "again"), offer(2, local("2026-10-26T12:00:00"))];
    const step = nextOffer({ history, expiresAt: local("2026-10-26T12:00:00") }, local("2026-10-26T13:00:00"));
    expect(step).toEqual({ kind: "exhausted", at: local("2026-10-27T10:00:00") });
  });

  it("does not open a second chance for links that expired more than seven days ago", () => {
    const old = local("2026-10-01T10:00:00");
    expect(nextOffer({ history: [], expiresAt: old }, local("2026-10-08T10:00:00"))).toEqual({
      kind: "exhausted",
      at: local("2026-10-08T10:00:00"),
    });
    expect(nextOffer({ history: [], expiresAt: old }, local("2026-10-08T09:59:00"))).toMatchObject({
      kind: "due",
      occasion: 1,
    });
  });
});

describe("linkStateFor", () => {
  const expiry = local("2026-10-20T10:00:00");

  it("is live before expiry, expired while offers remain, exhausted after", () => {
    expect(linkStateFor({ history: [], expiresAt: expiry }, local("2026-10-20T09:00:00"))).toBe("live");
    expect(linkStateFor({ history: [], expiresAt: expiry }, expiry)).toBe("expired");
    const history = ignoredChain(expiry, 7);
    expect(linkStateFor({ history, expiresAt: expiry }, history[6].dueAt)).toBe("expired");
    expect(linkStateFor({ history, expiresAt: expiry }, new Date(history[6].dueAt.getTime() + DAY))).toBe("exhausted");
  });
});

describe("offerDueStamp", () => {
  it("keeps the planned time when sent on time and the send time when caught up late", () => {
    const due = local("2026-10-20T10:00:00");
    expect(offerDueStamp(due, local("2026-10-20T10:20:00"))).toEqual(due);
    expect(offerDueStamp(due, local("2026-10-20T12:00:00"))).toEqual(local("2026-10-20T12:00:00"));
  });
});

describe("pickOfferTemplate", () => {
  const notOpened = { id: 1, day: 1, position: 0, timingType: "occasion" as const, statuses: ["link_berildi" as const] };
  const noPrice = {
    id: 2,
    day: 1,
    position: 0,
    timingType: "occasion" as const,
    statuses: ["korishni_boshladi" as const, "dars_yarmida" as const, "sotuvda_toxtadi" as const],
  };
  const second = { ...notOpened, id: 3, day: 2 };

  it("picks the page for the occasion and the §3.8 variant for people who stopped before the price", () => {
    const templates = [notOpened, noPrice, second];
    expect(pickOfferTemplate(templates, 1, "link_berildi")?.id).toBe(1);
    expect(pickOfferTemplate(templates, 1, "dars_yarmida")?.id).toBe(2);
    expect(pickOfferTemplate(templates, 2, "link_berildi")?.id).toBe(3);
  });

  it("returns nothing for an empty page", () => {
    expect(pickOfferTemplate([notOpened, noPrice, second], 2, "sotuvda_toxtadi")).toBeNull();
    expect(pickOfferTemplate([notOpened], 3, "link_berildi")).toBeNull();
    expect(pickOfferTemplate([notOpened, noPrice], 1, "narxni_kurdi")).toBeNull();
  });
});
