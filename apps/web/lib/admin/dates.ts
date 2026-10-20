export function getTashkentToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export type Preset = "today" | "7d" | "30d";

export const PRESET_DAYS: Record<Preset, number> = { today: 0, "7d": 6, "30d": 29 };

export function activePreset(from: string, to: string): Preset | null {
  const today = getTashkentToday();
  if (to !== today) return null;
  const match = (Object.keys(PRESET_DAYS) as Preset[]).find((preset) => addDays(today, -PRESET_DAYS[preset]) === from);
  return match ?? null;
}
