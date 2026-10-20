export const funnelStatuses = [
  "link_berildi",
  "korishni_boshladi",
  "dars_yarmida",
  "sotuvda_toxtadi",
  "narxni_kurdi",
  "adminga_yozdi",
] as const;

export type FunnelStatus = (typeof funnelStatuses)[number];

export const funnelSegments = ["A", "B", "C", "D"] as const;

export type FunnelSegment = (typeof funnelSegments)[number];

export const chainSegments = ["A", "B", "C"] as const satisfies readonly FunnelSegment[];

export const segmentEndReasons = [
  "advanced",
  "wrote_admin",
  "bot_blocked",
  "expired",
  "relinked",
  "offers_exhausted",
] as const;

export type SegmentEndReason = (typeof segmentEndReasons)[number];

export const startModes = ["resume", "offer", "again"] as const;

export type StartMode = (typeof startModes)[number];

export const SECOND_CHANCE_OCCASIONS = 7;

export const SECOND_CHANCE_WINDOW_DAYS = 7;

export const SECOND_CHANCE_INTERVAL_HOURS = 24;

export const MAX_LINK_ATTEMPTS = SECOND_CHANCE_OCCASIONS + 1;

export const linkGrantKinds = ["initial", "again", "scheduled"] as const;

export type LinkGrantKind = (typeof linkGrantKinds)[number];

export const offerVariants = ["not_opened", "no_price"] as const;

export type OfferVariant = (typeof offerVariants)[number];

export const offerVariantStatuses: Record<OfferVariant, readonly FunnelStatus[]> = {
  not_opened: ["link_berildi"],
  no_price: ["korishni_boshladi", "dars_yarmida", "sotuvda_toxtadi"],
};

export function offerVariantFor(status: FunnelStatus | null): OfferVariant | null {
  for (const variant of offerVariants) {
    if (status !== null && offerVariantStatuses[variant].includes(status)) return variant;
  }
  return null;
}

export function offerVariantOf(statuses: readonly FunnelStatus[] | null): OfferVariant | null {
  if (statuses === null) return null;
  for (const variant of offerVariants) {
    const expected = offerVariantStatuses[variant];
    if (statuses.length === expected.length && expected.every((status) => statuses.includes(status))) return variant;
  }
  return null;
}

export const offerAnswers = ["again", "later"] as const;

export type OfferAnswer = (typeof offerAnswers)[number];

export const appointmentPurposes = ["reopen", "remind"] as const;

export type AppointmentPurpose = (typeof appointmentPurposes)[number];

export const LATER_FIRST_HOUR = 7;

export const LATER_LAST_HOUR = 22;

export const LATER_PRE_REMINDER_MINUTES = 60;

export const laterQuickSlots = {
  tonight: { dayOffset: 0, hour: 20 },
  tomorrowMorning: { dayOffset: 1, hour: 8 },
  tomorrowEvening: { dayOffset: 1, hour: 20 },
} as const;

export type LaterQuickSlot = keyof typeof laterQuickSlots;

export const laterQuickSlotKeys = Object.keys(laterQuickSlots) as LaterQuickSlot[];

export const laterDayOffsets = [0, 1, 2] as const;

export type LaterDayOffset = (typeof laterDayOffsets)[number];
