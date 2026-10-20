import {
  isInMarkRange,
  markRange,
  parseMmSs,
  type VideoMarkKey,
  type VideoMarkRange,
  type VideoMarks,
} from "@funnel/shared";
import type { BotVideoStep, BotVideoUploadStatus } from "@/db/schema";

export type DraftState = {
  step: BotVideoStep;
  duration: number | null;
  courseStartSec: number | null;
  priceSec: number | null;
  introEndSec: number | null;
  unlockSec: number | null;
};

export type DraftInput =
  | { type: "confirm"; yes: boolean }
  | { type: "text"; value: string }
  | { type: "skip" }
  | { type: "keep" }
  | { type: "back" }
  | { type: "activate" }
  | { type: "cancel" };

export type ReplyKey =
  | "askDuration"
  | "askIntro"
  | "askCourse"
  | "askPrice"
  | "askUnlock"
  | "summary"
  | "cancelled"
  | "activating";
export type Effect = "startUpload" | "activate";

export type DraftPatch = Partial<DraftState> & { uploadStatus?: BotVideoUploadStatus };

export type TransitionError =
  | { error: "invalidTime" | "durationNotPositive" }
  | { error: "wrongStep" }
  | { error: "outOfRange"; value: number };

export type Transition = { patch: DraftPatch; reply: ReplyKey; effects: Effect[] } | TransitionError;

const wrongStep: Transition = { error: "wrongStep" };

export const MARK_STEPS = ["intro", "course", "price", "unlock"] as const satisfies BotVideoStep[];
export type MarkStep = (typeof MARK_STEPS)[number];

export const TEXT_STEPS = ["duration", ...MARK_STEPS] as const satisfies BotVideoStep[];

export const markStepFields = {
  intro: "introEndSec",
  course: "courseStartSec",
  price: "priceSec",
  unlock: "unlockSec",
} as const satisfies Record<MarkStep, VideoMarkKey>;

const OPTIONAL_STEPS: readonly MarkStep[] = ["intro", "unlock"];

const nextSteps = {
  duration: { step: "intro", reply: "askIntro" },
  intro: { step: "course", reply: "askCourse" },
  course: { step: "price", reply: "askPrice" },
  price: { step: "unlock", reply: "askUnlock" },
  unlock: { step: "summary", reply: "summary" },
} as const satisfies Record<(typeof TEXT_STEPS)[number], { step: BotVideoStep; reply: ReplyKey }>;

const previousSteps: Partial<Record<BotVideoStep, { step: MarkStep; reply: ReplyKey }>> = {
  course: { step: "intro", reply: "askIntro" },
  price: { step: "course", reply: "askCourse" },
  unlock: { step: "price", reply: "askPrice" },
  summary: { step: "unlock", reply: "askUnlock" },
};

export function isOpenStep(step: BotVideoStep) {
  return step !== "done" && step !== "cancelled";
}

export function isMarkStep(step: BotVideoStep): step is MarkStep {
  return MARK_STEPS.some((candidate) => candidate === step);
}

export function canGoBack(step: BotVideoStep) {
  return step in previousSteps;
}

export function isOptionalStep(step: MarkStep) {
  return OPTIONAL_STEPS.includes(step);
}

export function marksBefore(draft: DraftState, step: MarkStep): VideoMarks {
  const index = MARK_STEPS.indexOf(step);
  return Object.fromEntries(
    MARK_STEPS.slice(0, index).map((earlier) => [markStepFields[earlier], draft[markStepFields[earlier]]]),
  );
}

export function stepRange(draft: DraftState, step: MarkStep): VideoMarkRange {
  return markRange(markStepFields[step], marksBefore(draft, step), draft.duration ?? 0);
}

export function keepableValue(draft: DraftState, step: MarkStep) {
  const value = draft[markStepFields[step]];
  return value !== null && isInMarkRange(stepRange(draft, step), value) ? value : null;
}

function advance(step: MarkStep, value: number | null): Transition {
  const next = nextSteps[step];
  return { patch: { step: next.step, [markStepFields[step]]: value }, reply: next.reply, effects: [] };
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
      : { patch: { step: "intro", uploadStatus: "pending" }, reply: "askIntro", effects: ["startUpload"] };
  }

  if (input.type === "activate") {
    return draft.step === "summary" ? { patch: {}, reply: "activating", effects: ["activate"] } : wrongStep;
  }

  if (input.type === "back") {
    const previous = previousSteps[draft.step];
    return previous ? { patch: { step: previous.step }, reply: previous.reply, effects: [] } : wrongStep;
  }

  if (input.type === "skip") {
    if (!isMarkStep(draft.step) || !isOptionalStep(draft.step)) return wrongStep;
    return advance(draft.step, null);
  }

  if (input.type === "keep") {
    if (!isMarkStep(draft.step)) return wrongStep;
    const value = draft[markStepFields[draft.step]];
    if (value === null) return wrongStep;
    if (keepableValue(draft, draft.step) === null) return { error: "outOfRange", value };
    return advance(draft.step, value);
  }

  const seconds = parseMmSs(input.value);

  if (draft.step === "duration") {
    if (seconds === null) return { error: "invalidTime" };
    if (seconds <= 0) return { error: "durationNotPositive" };
    return { patch: { step: "intro", duration: seconds }, reply: "askIntro", effects: [] };
  }

  if (!isMarkStep(draft.step)) return wrongStep;
  if (seconds === null) return { error: "invalidTime" };
  if (!isInMarkRange(stepRange(draft, draft.step), seconds)) return { error: "outOfRange", value: seconds };
  return advance(draft.step, seconds);
}
