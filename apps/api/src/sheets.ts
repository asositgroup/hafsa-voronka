import { JWT } from "google-auth-library";
import { env } from "@/env";

const REQUEST_TIMEOUT_MS = 10_000;

let authClient: JWT | undefined;

function getAuthClient() {
  authClient ??= new JWT({
    email: env.GOOGLE_SA_EMAIL,
    key: env.GOOGLE_SA_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"],
  });
  return authClient;
}

export function googleAuthHeaders() {
  return getAuthClient().getRequestHeaders();
}

export function formatTashkentDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

export function sheetPhone(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.startsWith("'") ? phone : `'${phone}`;
}

async function sheetsRequest<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }) {
  const headers = await googleAuthHeaders();
  headers.set("Content-Type", "application/json");
  const sheetId = encodeURIComponent(env.SHEET_ID!);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Sheets API error ${response.status}: ${errorBody}`);
  }
  return (await response.json()) as T;
}

export async function readColumn(range: string): Promise<string[]> {
  const result = await sheetsRequest<{ values?: string[][] }>(
    `values/${encodeURIComponent(range)}?majorDimension=COLUMNS`,
    { method: "GET" },
  );
  return result.values?.[0] ?? [];
}

export async function writeRanges(data: { range: string; values: unknown[][] }[]) {
  if (data.length === 0) return;
  await sheetsRequest("values:batchUpdate", {
    method: "POST",
    body: { valueInputOption: "USER_ENTERED", data },
  });
}

export async function appendRows(range: string, rows: unknown[][]) {
  if (rows.length === 0) return;
  await sheetsRequest(`values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: { values: rows },
  });
}
