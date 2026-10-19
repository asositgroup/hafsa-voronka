import { parseMmSs } from "@funnel/shared";
import type { BotVideoStep, BotVideoUploadStatus } from "@/db/schema";

export type DraftState = {
  step: BotVideoStep;
  duration: number | null;
  courseStartSec: number | null;
  priceSec: number | null;
};

export type DraftInput =
  | { type: "confirm"; yes: boolean }
  | { type: "text"; value: string }
  | { type: "activate" }
  | { type: "cancel" };

export type ReplyKey = "askDuration" | "askCourse" | "askPrice" | "summary" | "cancelled" | "activating";
export type ErrorKey =
  | "invalidTime"
  | "durationNotPositive"
  | "courseOutOfRange"
  | "priceBeforeCourse"
  | "priceOutOfRange"
  | "wrongStep";
export type Effect = "startUpload" | "activate";

export type DraftPatch = Partial<DraftState> & { uploadStatus?: BotVideoUploadStatus };

export type Transition =
  | { patch: DraftPatch; reply: ReplyKey; effects: Effect[] }
  | { error: ErrorKey };

const wrongStep: Transition = { error: "wrongStep" };

export function isOpenStep(step: BotVideoStep) {
  return step !== "done" && step !== "cancelled";
}

export function transition(draft: DraftState, input: DraftInput): Transition {
  if (input.type === "cancel") {
    return isOpenStep(draft.step)
      ? { patch: { step: "cancelled" }, reply: "cancelled", effects: [] }
      : wrongStep;
  }

  if (input.type === "confirm") {
    if (draft.step !== "confirm") return wrongStep;
    if (!input.yes) return { patch: { step: "cancelled" }, reply: "cancelled", effects: [] };
    return draft.duration === null
      ? { patch: { step: "duration", uploadStatus: "pending" }, reply: "askDuration", effects: ["startUpload"] }
      : { patch: { step: "course", uploadStatus: "pending" }, reply: "askCourse", effects: ["startUpload"] };
  }

  if (input.type === "activate") {
    return draft.step === "summary" ? { patch: {}, reply: "activating", effects: ["activate"] } : wrongStep;
  }

  const seconds = parseMmSs(input.value);

  if (draft.step === "duration") {
    if (seconds === null) return { error: "invalidTime" };
    if (seconds <= 0) return { error: "durationNotPositive" };
    return { patch: { step: "course", duration: seconds }, reply: "askCourse", effects: [] };
  }

  if (draft.step === "course") {
    if (seconds === null) return { error: "invalidTime" };
    if (seconds <= 0 || seconds >= draft.duration!) return { error: "courseOutOfRange" };
    return { patch: { step: "price", courseStartSec: seconds }, reply: "askPrice", effects: [] };
  }

  if (draft.step === "price") {
    if (seconds === null) return { error: "invalidTime" };
    if (seconds <= draft.courseStartSec!) return { error: "priceBeforeCourse" };
    if (seconds >= draft.duration!) return { error: "priceOutOfRange" };
    return { patch: { step: "summary", priceSec: seconds }, reply: "summary", effects: [] };
  }

  return wrongStep;
}
