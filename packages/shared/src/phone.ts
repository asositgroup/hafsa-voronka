export const ALLOWED_UZ_OPERATORS = [
  "90",
  "91",
  "93",
  "94",
  "95",
  "97",
  "98",
  "99",
  "33",
  "50",
  "55",
  "77",
  "88",
] as const;

const operatorSet = new Set<string>(ALLOWED_UZ_OPERATORS);

export function normalizeUzPhone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^[+\d\s\-()]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, "");
  let subscriber: string;

  if (digits.length === 12 && digits.startsWith("998")) {
    subscriber = digits.slice(3);
  } else if (digits.length === 9) {
    subscriber = digits;
  } else {
    return null;
  }

  const operator = subscriber.slice(0, 2);
  if (!operatorSet.has(operator)) return null;

  return `+998${subscriber}`;
}

export function normalizeContactPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}
