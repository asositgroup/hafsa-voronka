import { type Column, notInArray, type SQL, sql, type SQLWrapper } from "drizzle-orm";
import { env } from "@/env";

export function isAdminTelegramId(id: number | undefined): boolean {
  return id !== undefined && env.ADMIN_TELEGRAM_IDS.has(id);
}

export function notAdminTelegramId(telegramId: Column | SQLWrapper): SQL {
  return sql`(${telegramId} IS NULL OR ${notInArray(telegramId, [...env.ADMIN_TELEGRAM_IDS])})`;
}
