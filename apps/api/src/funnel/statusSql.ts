import { type SQL, sql } from "drizzle-orm";
import type { FunnelStatus } from "@funnel/shared";
import { users, videos, watchProgress } from "@/db/schema";
import { NO_VIDEO_MARKS } from "./status";

export function funnelStatusSql(): SQL<FunnelStatus | null> {
  const position = watchProgress.maxPosition;
  const lessonStart = sql`coalesce(${videos.introEndSec}::float8, coalesce(${videos.courseStartSec}, ${videos.priceSec}, ${videos.duration}, ${NO_VIDEO_MARKS.duration})::float8 / 2)`;
  return sql<FunnelStatus | null>`case
    when ${users.registeredAt} is null then null
    when ${users.wroteAdminAt} is not null then 'adminga_yozdi'
    when ${users.offerWatchedAt} is not null then 'narxni_kurdi'
    when ${watchProgress.userId} is null or (${watchProgress.startedAt} is null and ${position} = 0) then 'link_berildi'
    when ${videos.priceSec} is not null and ${position} >= ${videos.priceSec} then 'narxni_kurdi'
    when ${videos.courseStartSec} is not null and ${position} >= ${videos.courseStartSec} then 'sotuvda_toxtadi'
    when ${position} >= ${lessonStart} then 'dars_yarmida'
    else 'korishni_boshladi'
  end`;
}
