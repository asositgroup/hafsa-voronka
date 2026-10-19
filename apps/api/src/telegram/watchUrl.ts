import type { StartMode } from "@funnel/shared";
import { env } from "@/env";

export function watchAppUrl(start?: StartMode) {
  return `${env.WEB_URL}/app${start ? `?start=${start}` : ""}`;
}
