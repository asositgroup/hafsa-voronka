import { describe, expect, it } from "vitest";
import { nextOfferGate, offerGateFor } from "./offerGate";

const offer = { url: "https://cdn.example.com/offer.mp4", duration: 90 };
const open = (offerFirst: typeof offer | null = null) => ({ expired: false, offerFirst });
const expired = { expired: true, offerFirst: null };

describe("offerGateFor", () => {
  it("captures the offer of the session it starts from", () => {
    expect(offerGateFor(open(offer))).toEqual({ url: offer.url, dismissed: false, expired: false });
    expect(offerGateFor(open())).toEqual({ url: null, dismissed: false, expired: false });
  });
});

describe("nextOfferGate", () => {
  it("keeps the offer when a later session drops it", () => {
    const gate = offerGateFor(open(offer));
    expect(nextOfferGate(gate, open())).toBe(gate);
  });

  it("keeps a dismissed offer dismissed while the link stays open", () => {
    const gate = { ...offerGateFor(open(offer)), dismissed: true };
    expect(nextOfferGate(gate, open(offer))).toBe(gate);
  });

  it("captures the reopened link's offer after the lesson closed", () => {
    const closed = offerGateFor(expired);
    expect(nextOfferGate(closed, expired)).toBe(closed);
    expect(nextOfferGate(closed, open(offer))).toEqual({ url: offer.url, dismissed: false, expired: false });
  });

  it("shows the offer again when the link closes and reopens after it was dismissed", () => {
    const dismissed = { ...offerGateFor(open(offer)), dismissed: true };
    const closed = nextOfferGate(dismissed, expired);
    expect(closed.expired).toBe(true);
    expect(nextOfferGate(closed, open(offer))).toEqual({ url: offer.url, dismissed: false, expired: false });
  });

  it("clears the offer when the reopened link has none", () => {
    const closed = nextOfferGate(offerGateFor(open(offer)), expired);
    expect(nextOfferGate(closed, open())).toEqual({ url: null, dismissed: false, expired: false });
  });
});
