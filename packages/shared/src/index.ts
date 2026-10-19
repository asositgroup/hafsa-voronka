export const eventTypes = [
  "landing_view",
  "cta_click",
  "lead_submitted",
  "bot_start",
  "app_open",
  "registered",
  "video_start",
  "progress_25",
  "progress_50",
  "progress_75",
  "video_complete",
  "channel_click",
  "reminder_when_open",
  "reminder_when_answer",
  "reminder_later",
  "message_click",
] as const;

export type EventType = (typeof eventTypes)[number];

export type Utm = {
  utm_source?: string;
  utm_campaign?: string;
  utm_content?: string;
  fbclid?: string;
};

export * from "./phone";
export * from "./schemas";
export * from "./video";
export * from "./track";
export * from "./admin";
export * from "./lead";
export * from "./botTexts";
export * from "./funnel";
export * from "./time";
export * from "./adminVideos";
export * from "./messages";
