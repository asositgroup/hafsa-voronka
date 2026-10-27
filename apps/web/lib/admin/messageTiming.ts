import { type FunnelSegment, linkBoundSegments, type TemplateKind } from "@funnel/shared";
import { adminUz } from "../i18n/admin";

const copy = adminUz.messages;

export type TimingMode = "relative" | "clock" | "expiry";

export type TimingSubject = { segment: FunnelSegment; day: number; kind: TemplateKind; atExpiry: boolean };

type TimedSubject = TimingSubject & { minute: number };

export type RelativeAnchor = keyof typeof copy.timing.after;

const RELATIVE_DEFAULT_MINUTE = 60;
const CLOCK_DEFAULT_MINUTE = 600;

export function timingMode({ segment, day, kind, atExpiry }: TimingSubject): TimingMode {
  if (kind === "trigger") return atExpiry ? "expiry" : "clock";
  return day === 1 || linkBoundSegments.includes(segment) ? "relative" : "clock";
}

export function relativeAnchor(segment: FunnelSegment, day: number): RelativeAnchor {
  if (day === 1 || !linkBoundSegments.includes(segment)) return segment;
  return segment === "B" ? "reopenB" : "reopenA";
}

export function defaultMinuteFor(subject: TimingSubject): number {
  return timingMode(subject) === "relative" ? RELATIVE_DEFAULT_MINUTE : CLOCK_DEFAULT_MINUTE;
}

export function clockTime(minute: number): string {
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function duration(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  const parts = [
    hours > 0 ? `${hours} ${copy.editor.hours}` : null,
    minutes > 0 ? `${minutes} ${copy.editor.minutes}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" ") : `0 ${copy.editor.minutes}`;
}

export function timelineLabel(subject: TimedSubject): string {
  const mode = timingMode(subject);
  if (mode === "expiry") return copy.timing.atExpiry;
  return mode === "relative" ? `+${duration(subject.minute)}` : clockTime(subject.minute);
}

export function timingSummary(subject: TimedSubject): string {
  const mode = timingMode(subject);
  if (mode === "expiry") return copy.timing.atExpiry;
  if (subject.kind === "trigger") return copy.timing.triggerClock.replace("{time}", clockTime(subject.minute));
  if (mode === "clock") {
    return copy.timing.clock.replace("{n}", String(subject.day)).replace("{time}", clockTime(subject.minute));
  }
  return copy.timing.after[relativeAnchor(subject.segment, subject.day)].replace("{time}", duration(subject.minute));
}
