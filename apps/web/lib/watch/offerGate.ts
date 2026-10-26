import type { SessionResponse } from "@funnel/shared";

export type OfferGate = { url: string | null; dismissed: boolean; expired: boolean };

type OfferGateSession = Pick<SessionResponse, "expired" | "offerFirst">;

export function offerGateFor(session: OfferGateSession): OfferGate {
  return { url: session.offerFirst?.url ?? null, dismissed: false, expired: session.expired };
}

export function nextOfferGate(gate: OfferGate, session: OfferGateSession): OfferGate {
  if (gate.expired === session.expired) return gate;
  if (session.expired) return { ...gate, expired: true };
  return offerGateFor(session);
}
