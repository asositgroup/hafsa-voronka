export const funnelStatuses = [
  "link_berildi",
  "korishni_boshladi",
  "dars_yarmida",
  "sotuvda_toxtadi",
  "narxni_kurdi",
  "adminga_yozdi",
] as const;

export type FunnelStatus = (typeof funnelStatuses)[number];

export const funnelSegments = ["A", "B", "C"] as const;

export type FunnelSegment = (typeof funnelSegments)[number];

export const segmentEndReasons = [
  "advanced",
  "wrote_admin",
  "bot_blocked",
  "expired",
  "relinked",
  "offers_exhausted",
  "rollout",
] as const;

export type SegmentEndReason = (typeof segmentEndReasons)[number];

export const startModes = ["resume", "offer", "again"] as const;

export type StartMode = (typeof startModes)[number];

export const LINK_ATTEMPT_OPTIONS = 8;

export const linkGrantKinds = ["initial", "again", "scheduled", "rollout"] as const;

export type LinkGrantKind = (typeof linkGrantKinds)[number];

export const offerVariants = ["not_opened", "no_price"] as const;

export type OfferVariant = (typeof offerVariants)[number];

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
