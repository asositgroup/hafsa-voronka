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

export function resolveDateRange(from?: string, to?: string): { from: string; to: string } {
  const defaultTo = getTashkentToday();
  const resolvedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo;
  const defaultFrom = addDays(resolvedTo, -6);
  const resolvedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom;

  if (resolvedFrom > resolvedTo) {
    return { from: resolvedTo, to: resolvedFrom };
  }
  return { from: resolvedFrom, to: resolvedTo };
}

export function listDaysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  let current = from;
  while (current <= to) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

export function formatTashkentDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(d).replace(", ", " ");
}
