import { env } from "@/env";

export function isAdminTelegramId(id: number | undefined): boolean {
  return id !== undefined && env.ADMIN_TELEGRAM_IDS.has(id);
}
