import {
  defaultLessonStartSec,
  formatMmSs,
  type VideoMarkKey,
  type VideoMarkRange,
  type VideoMarks,
  videoMarkKeys,
} from "@funnel/shared";
import { uz } from "@/i18n/uz";

const texts = uz.bot.videoMarks;

export type MarkStatus = "done" | "current" | "pending";

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
}

function unsetValue(key: VideoMarkKey, marks: VideoMarks, duration: number | null) {
  if (key === "unlockSec") return texts.unlockNow;
  if (key !== "introEndSec") return null;
  if (duration === null || (marks.courseStartSec == null && marks.priceSec == null)) return texts.auto;
  return fill(texts.autoValue, { value: formatMmSs(defaultLessonStartSec(marks, duration)) });
}

function markLine(key: VideoMarkKey, status: MarkStatus, marks: VideoMarks, duration: number | null) {
  const label = texts.labels[key];
  const value = marks[key];
  const time = value == null ? null : formatMmSs(value);
  if (status === "current") return fill(texts.current, { label, value: time ?? texts.unknown });
  if (status === "pending") {
    return time ? fill(texts.pendingValue, { label, value: time }) : fill(texts.pending, { label });
  }
  if (time) return fill(texts.done, { label, value: time });
  const fallback = unsetValue(key, marks, duration);
  return fallback
    ? fill(texts.skipped, { label, value: fallback })
    : fill(texts.pendingValue, { label, value: texts.missing });
}

export function checklistText(
  duration: number | null,
  marks: VideoMarks,
  statusOf: (key: VideoMarkKey) => MarkStatus,
) {
  const head = duration === null ? texts.durationAsk : fill(texts.duration, { value: formatMmSs(duration) });
  return [head, ...videoMarkKeys.map((key) => markLine(key, statusOf(key), marks, duration))].join("\n");
}

export function isEmptyRange(range: VideoMarkRange) {
  return range.min > range.max;
}

function ruleText(range: VideoMarkRange, marks: VideoMarks, duration: number) {
  const parts: string[] = [];
  if (range.after) {
    parts.push(fill(texts.afterMark, { mark: texts.fromMark[range.after], value: formatMmSs(marks[range.after]!) }));
  } else if (range.min > 0) {
    parts.push(texts.afterStart);
  }
  parts.push(
    range.before
      ? fill(texts.beforeMark, { mark: texts.fromMark[range.before], value: formatMmSs(marks[range.before]!) })
      : fill(texts.beforeEnd, { value: formatMmSs(duration) }),
  );
  return parts.join(texts.join);
}

export type NoRoomFix = "back" | "other";

function noRoomText(key: VideoMarkKey, range: VideoMarkRange, marks: VideoMarks, duration: number, fix: NoRoomFix) {
  const reason = fill(texts.noRoom, { label: texts.labels[key], rule: ruleText(range, marks, duration) });
  return `${reason} ${fix === "back" ? texts.noRoomBack : texts.noRoomOther}`;
}

export function rangeHint(
  key: VideoMarkKey,
  range: VideoMarkRange,
  marks: VideoMarks,
  duration: number,
  fix: NoRoomFix,
) {
  if (isEmptyRange(range)) return errorText(noRoomText(key, range, marks, duration, fix));
  return fill(texts.range, { min: formatMmSs(range.min), max: formatMmSs(range.max) });
}

export function rangeErrorText(
  key: VideoMarkKey,
  value: number,
  range: VideoMarkRange,
  marks: VideoMarks,
  duration: number,
) {
  if (isEmptyRange(range)) return null;
  return fill(texts.outOfRange, {
    value: formatMmSs(value),
    subject: texts.subjects[key],
    rule: ruleText(range, marks, duration),
    min: formatMmSs(range.min),
    max: formatMmSs(range.max),
  });
}

export function errorText(text: string) {
  return fill(texts.error, { text });
}
