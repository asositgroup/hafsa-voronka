import { and, count, eq, gte, inArray, isNotNull, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { RolloutAudience, RolloutFilter } from "@funnel/shared";
import { db } from "@/db";
import { leads, users, videoRolloutRecipients, videos, watchProgress } from "@/db/schema";
import { funnelStatusSql } from "@/funnel/statusSql";
import { DAY_MS } from "@/messages/plan";
import { notAdminTelegramId } from "@/telegram/admins";

type Executor = Pick<ReturnType<typeof db>, "select" | "execute">;

export function rolloutBucketSql(): SQL<RolloutAudience | null> {
  const status = funnelStatusSql();
  return sql<RolloutAudience | null>`case
    when exists (select 1 from ${leads} where ${leads.userId} = ${users.id} and ${leads.outcome} = 'won') then 'bought'
    when ${users.wroteAdminAt} is not null then 'wrote_admin'
    when ${status} = 'link_berildi' then 'not_opened'
    when ${status} in ('korishni_boshladi', 'dars_yarmida', 'sotuvda_toxtadi') then 'halfway'
    when ${status} = 'narxni_kurdi' then 'saw_price'
  end`;
}

export function rolloutAudienceWhere(filter: RolloutFilter, videoId: number, now: Date): SQL {
  return and(
    isNotNull(users.registeredAt),
    eq(users.botBlocked, false),
    notAdminTelegramId(users.telegramId),
    or(isNull(users.videoId), sql`${users.videoId} <> ${videoId}`),
    lte(users.linkExpiresAt, now),
    filter.sinceDays === null ? undefined : gte(users.createdAt, new Date(now.getTime() - filter.sinceDays * DAY_MS)),
    inArray(rolloutBucketSql(), [...filter.audiences]),
  )!;
}

export async function countRolloutAudience(
  executor: Executor,
  filter: RolloutFilter,
  videoId: number,
  now: Date,
): Promise<number> {
  const [row] = await executor
    .select({ value: count() })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(rolloutAudienceWhere(filter, videoId, now));
  return row?.value ?? 0;
}

export async function rolloutAudienceOf(
  executor: Executor,
  userId: number,
  filter: RolloutFilter,
  videoId: number,
  now: Date,
): Promise<RolloutAudience | null> {
  const [row] = await executor
    .select({ audience: rolloutBucketSql() })
    .from(users)
    .leftJoin(watchProgress, eq(watchProgress.userId, users.id))
    .leftJoin(videos, eq(videos.id, users.videoId))
    .where(and(eq(users.id, userId), rolloutAudienceWhere(filter, videoId, now)))
    .limit(1);
  return row?.audience ?? null;
}

export async function snapshotRolloutAudience(
  executor: Executor,
  rolloutId: number,
  filter: RolloutFilter,
  videoId: number,
  now: Date,
): Promise<number> {
  const inserted = await executor.execute<{ id: string }>(sql`
    insert into ${videoRolloutRecipients} (rollout_id, user_id, audience, updated_at)
    select ${rolloutId}, ${users.id}, ${rolloutBucketSql()}, ${now.toISOString()}::timestamptz
    from ${users}
    left join ${watchProgress} on ${watchProgress.userId} = ${users.id}
    left join ${videos} on ${videos.id} = ${users.videoId}
    where ${rolloutAudienceWhere(filter, videoId, now)}
    on conflict (rollout_id, user_id) do nothing
    returning id
  `);
  return inserted.length;
}
