import { TASHKENT_OFFSET_MS } from "@funnel/shared";
import { adminUz } from "../i18n/admin";

const copy = adminUz.videos.rollout;

export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function tashkentToIso(date: string, minuteOfDay: number): string {
  return `${date}T${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}:00+05:00`;
}

export function formatTashkentShort(iso: string): string {
  const local = new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS);
  return `${pad(local.getUTCDate())}.${pad(local.getUTCMonth() + 1)} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export function rolloutFailureMessage(error: string | undefined): string {
  return copy.errors[error as keyof typeof copy.errors] ?? copy.errors.generic;
}
