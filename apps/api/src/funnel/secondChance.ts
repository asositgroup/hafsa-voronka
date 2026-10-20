import {
  type FunnelStatus,
  MORNING_SEND_MINUTE,
  type OfferAnswer,
  offerVariantFor,
  offerVariantOf,
  SECOND_CHANCE_INTERVAL_HOURS,
  SECOND_CHANCE_OCCASIONS,
  SECOND_CHANCE_WINDOW_DAYS,
  type TimingType,
} from "@funnel/shared";
import { DAY_MS, GRACE_MS, HOUR_MS, isSameTashkentDay, MINUTE_MS, outOfNight, tashkentDayStart } from "@/messages/plan";
import type { LinkState } from "./status";

export type OfferRecord = { occasion: number; dueAt: Date; answer: OfferAnswer | null; reopened?: boolean };

export type OfferContext = {
  history: OfferRecord[];
  expiresAt: Date | null;
  pendingAppointment?: boolean;
};

export type OfferStep =
  | { kind: "live" }
  | { kind: "wait" }
  | { kind: "due"; occasion: number; dueAt: Date }
  | { kind: "exhausted"; at: Date };

const WINDOW_MS = SECOND_CHANCE_WINDOW_DAYS * DAY_MS;
const INTERVAL_MS = SECOND_CHANCE_INTERVAL_HOURS * HOUR_MS;

function nextMorning(date: Date): Date {
  return new Date(tashkentDayStart(date).getTime() + DAY_MS + MORNING_SEND_MINUTE * MINUTE_MS);
}

export function nextOffer(context: OfferContext, now: Date): OfferStep {
  const { expiresAt } = context;
  if (expiresAt === null || expiresAt.getTime() > now.getTime()) return { kind: "live" };

  const history = [...context.history].sort((a, b) => a.occasion - b.occasion);
  const first = history[0];
  const last = history[history.length - 1];
  const windowEnd = (first?.dueAt ?? expiresAt).getTime() + WINDOW_MS;

  let base: Date;
  if (!last) {
    base = expiresAt;
  } else {
    if (context.pendingAppointment) return { kind: "wait" };
    base = last.answer === "again" || last.reopened ? expiresAt : new Date(last.dueAt.getTime() + INTERVAL_MS);
  }
  const occasion = (last?.occasion ?? 0) + 1;

  let dueAt = outOfNight(base);
  if (last && isSameTashkentDay(dueAt, last.dueAt)) dueAt = nextMorning(last.dueAt);

  if (occasion > SECOND_CHANCE_OCCASIONS || dueAt.getTime() >= windowEnd) {
    return { kind: "exhausted", at: new Date(Math.min(dueAt.getTime(), windowEnd)) };
  }
  if (now.getTime() >= windowEnd) return { kind: "exhausted", at: new Date(windowEnd) };
  return { kind: "due", occasion, dueAt };
}

export function linkStateFor(context: OfferContext, now: Date): LinkState {
  const step = nextOffer(context, now);
  if (step.kind === "live") return "live";
  return step.kind === "exhausted" && now.getTime() >= step.at.getTime() ? "exhausted" : "expired";
}

export function offerDueStamp(dueAt: Date, now: Date): Date {
  return now.getTime() - dueAt.getTime() > GRACE_MS ? now : dueAt;
}

type OfferTemplate = {
  id: number;
  day: number;
  position: number;
  timingType: TimingType;
  statuses: readonly FunnelStatus[] | null;
};

export function pickOfferTemplate<T extends OfferTemplate>(
  templates: T[],
  occasion: number,
  status: FunnelStatus | null,
): T | null {
  if (status === null) return null;
  const variant = offerVariantFor(status);
  if (variant === null) return null;
  const pages = templates
    .filter((template) => template.timingType === "occasion" && template.day === occasion && template.statuses !== null)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const own = pages.find((template) => template.statuses?.includes(status));
  if (own) return own;
  if (variant === "not_opened") return null;
  return pages.find((template) => offerVariantOf(template.statuses) === "not_opened") ?? null;
}
