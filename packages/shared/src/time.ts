export function formatMmSs(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function parseMmSs(input: string): number | null {
  const value = input.trim();
  const short = /^(\d{1,3}):([0-5]\d)$/.exec(value);
  if (short) return Number(short[1]) * 60 + Number(short[2]);
  const long = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value);
  if (long) return Number(long[1]) * 3600 + Number(long[2]) * 60 + Number(long[3]);
  return null;
}
