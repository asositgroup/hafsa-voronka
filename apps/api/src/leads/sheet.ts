import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { db, rawClient } from "@/db";
import { type Lead, leads, type User, users, videos, watchProgress } from "@/db/schema";
import { env } from "@/env";
import { appendRows, formatTashkentDate, readColumn, sheetPhone, writeRanges } from "@/sheets";
import { assigneeLabel, outcomeLabels, watchedPercent } from "./card";

const SHEETS_LOCK_KEY = 849204812;
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 100;
const TAB = "Leads";

export const leadSheetHeaders = [
  "Lead ID",
  "Sana",
  "Manba",
  "Ism",
  "Telefon (forma)",
  "Telegram raqami",
  "Raqam tasdiqlangan",
  "Telegram",
  "Telegram ID",
  "Botga kirdi",
  "Video %",
  "Video tugadi",
  "Mas'ul",
  "Natija",
  "UTM Source",
  "UTM Campaign",
  "UTM Content",
];

const LAST_COLUMN = String.fromCharCode("A".charCodeAt(0) + leadSheetHeaders.length - 1);

export type SheetUser = Pick<
  User,
  "telegramId" | "username" | "phone" | "phoneVerified" | "registeredAt" | "completedAt"
>;

function sourceLabel(lead: Lead, user: SheetUser | null) {
  const form = lead.formSubmittedAt;
  const bot = user?.registeredAt;
  if (form && bot) return form <= bot ? "sayt → bot" : "bot → sayt";
  return bot ? "bot" : "sayt";
}

function dateCell(date: Date | null | undefined) {
  return date ? formatTashkentDate(date) : "";
}

export function renderLeadRow(
  lead: Lead,
  user: SheetUser | null,
  progress: { maxPosition: number | null; duration: number | null } | null,
) {
  const registered = user?.registeredAt ? user : null;
  const username = registered?.username ? `@${registered.username.replace(/^@/, "")}` : "";

  return [
    lead.id,
    formatTashkentDate(lead.createdAt),
    sourceLabel(lead, registered),
    lead.name,
    lead.formSubmittedAt ? sheetPhone(lead.phone) : "",
    sheetPhone(registered?.phone),
    registered ? registered.phoneVerified : "",
    username,
    registered ? String(registered.telegramId) : "",
    dateCell(registered?.registeredAt),
    registered ? `${watchedPercent(progress?.maxPosition ?? 0, progress?.duration ?? 0)}%` : "",
    dateCell(registered?.completedAt),
    lead.assigneeTelegramId !== null ? assigneeLabel(lead) : "",
    lead.outcome ? outcomeLabels[lead.outcome] : "",
    lead.utmSource ?? "",
    lead.utmCampaign ?? "",
    lead.utmContent ?? "",
  ];
}

function rowRange(rowNumber: number) {
  return `${TAB}!A${rowNumber}:${LAST_COLUMN}${rowNumber}`;
}

async function syncPending() {
  const pending = await db()
    .select({
      lead: leads,
      user: users,
      maxPosition: watchProgress.maxPosition,
      duration: videos.duration,
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.userId))
    .leftJoin(watchProgress, eq(watchProgress.userId, leads.userId))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(and(gt(leads.notifyVersion, leads.sheetsSyncedVersion), lt(leads.sheetsAttempts, MAX_ATTEMPTS)))
    .orderBy(asc(leads.id))
    .limit(BATCH_SIZE);

  if (pending.length === 0) return;

  try {
    const ids = await readColumn(`${TAB}!A:A`);
    const rowByLeadId = new Map(ids.map((id, index) => [id, index + 1]));
    const updates: { range: string; values: unknown[][] }[] = [
      { range: rowRange(1), values: [leadSheetHeaders] },
    ];
    const appends: unknown[][] = [];

    for (const { lead, user, maxPosition, duration } of pending) {
      const row = renderLeadRow(lead, user, { maxPosition, duration });
      const rowNumber = rowByLeadId.get(String(lead.id));
      if (rowNumber) updates.push({ range: rowRange(rowNumber), values: [row] });
      else appends.push(row);
    }

    await writeRanges(updates);
    await appendRows(`${TAB}!A:${LAST_COLUMN}`, appends);

    for (const { lead } of pending) {
      await db()
        .update(leads)
        .set({ sheetsSyncedVersion: lead.notifyVersion, sheetsError: null })
        .where(eq(leads.id, lead.id));
    }
  } catch (error) {
    console.error("Lead sheet sync failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    for (const { lead } of pending) {
      await db()
        .update(leads)
        .set({ sheetsAttempts: sql`${leads.sheetsAttempts} + 1`, sheetsError: message })
        .where(eq(leads.id, lead.id));
    }
  }
}

export async function flushLeadSheet() {
  if (!env.SHEETS_ENABLED) return;
  const conn = await rawClient().reserve();
  try {
    const [lock] = await conn`SELECT pg_try_advisory_lock(${SHEETS_LOCK_KEY}) as locked`;
    if (!lock?.locked) return;
    try {
      await syncPending();
    } finally {
      await conn`SELECT pg_advisory_unlock(${SHEETS_LOCK_KEY})`;
    }
  } finally {
    conn.release();
  }
}
