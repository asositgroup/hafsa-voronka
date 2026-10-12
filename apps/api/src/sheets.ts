import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { JWT } from "google-auth-library";
import { db, rawClient } from "@/db";
import { sheetsQueue, type User } from "@/db/schema";
import { env } from "@/env";

const SHEETS_LOCK_KEY = 849204812;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

let authClient: JWT | undefined;

function getAuthClient() {
  authClient ??= new JWT({
    email: env.GOOGLE_SA_EMAIL,
    key: env.GOOGLE_SA_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return authClient;
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

export function formatLeadRow(user: User, registeredAt?: Date): unknown[] {
  const dateStr = formatTashkentDate(registeredAt ?? user.registeredAt ?? new Date());
  const phone = user.phone ?? "";
  const prefixedPhone = phone ? (phone.startsWith("'") ? phone : `'${phone}`) : "";
  const username = user.username
    ? user.username.startsWith("@")
      ? user.username
      : `@${user.username}`
    : "";

  return [
    dateStr,
    user.name ?? "",
    prefixedPhone,
    user.phoneVerified,
    username,
    String(user.telegramId),
    user.utmSource ?? "",
    user.utmCampaign ?? "",
    user.utmContent ?? "",
  ];
}

export async function appendRowsToSheets(rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  const client = getAuthClient();
  const headers = await client.getRequestHeaders();
  const range = encodeURIComponent("Leads!A:K");
  const sheetId = encodeURIComponent(env.SHEET_ID!);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Sheets API error ${response.status}: ${errorBody}`);
  }
}

export async function enqueueLead(userId: number, row: unknown[]) {
  const [entry] = await db()
    .insert(sheetsQueue)
    .values({ userId, row })
    .returning();
  return entry;
}

export async function sendLeadInline(entry: { id: number; row: unknown[] }) {
  try {
    await appendRowsToSheets([entry.row as unknown[]]);
    await db()
      .update(sheetsQueue)
      .set({ sentAt: new Date() })
      .where(eq(sheetsQueue.id, entry.id));
  } catch (err) {
    console.error("Sheets inline append failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await db()
      .update(sheetsQueue)
      .set({
        attempts: sql`${sheetsQueue.attempts} + 1`,
        lastError: message,
      })
      .where(eq(sheetsQueue.id, entry.id));
  }
}

export async function retrySheetsQueue(): Promise<{ sent: number; failed: number }> {
  const client = rawClient();
  const conn = await client.reserve();
  try {
    const [lock] = await conn`SELECT pg_try_advisory_lock(${SHEETS_LOCK_KEY}) as locked`;
    if (!lock?.locked) {
      return { sent: 0, failed: 0 };
    }

    try {
      const pending = await db()
        .select()
        .from(sheetsQueue)
        .where(and(isNull(sheetsQueue.sentAt), lt(sheetsQueue.attempts, 10)))
        .orderBy(asc(sheetsQueue.id))
        .limit(100);

      if (pending.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const ids = pending.map((p) => p.id);
      const rows = pending.map((p) => p.row as unknown[]);

      try {
        await appendRowsToSheets(rows);
        await db()
          .update(sheetsQueue)
          .set({ sentAt: new Date() })
          .where(inArray(sheetsQueue.id, ids));
        return { sent: pending.length, failed: 0 };
      } catch (err) {
        console.error("Sheets retry batch failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        await db()
          .update(sheetsQueue)
          .set({
            attempts: sql`${sheetsQueue.attempts} + 1`,
            lastError: message,
          })
          .where(inArray(sheetsQueue.id, ids));
        return { sent: 0, failed: pending.length };
      }
    } finally {
      await conn`SELECT pg_advisory_unlock(${SHEETS_LOCK_KEY})`;
    }
  } finally {
    conn.release();
  }
}

export function startSheetsRetryLoop(): () => void {
  const timer = setInterval(() => {
    retrySheetsQueue().catch((err) => {
      console.error("Sheets retry loop error:", err);
    });
  }, RETRY_INTERVAL_MS);

  return () => clearInterval(timer);
}
