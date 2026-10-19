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

export const segmentEndReasons = ["advanced", "wrote_admin", "bot_blocked"] as const;

export type SegmentEndReason = (typeof segmentEndReasons)[number];

export const startModes = ["resume", "offer"] as const;

export type StartMode = (typeof startModes)[number];
