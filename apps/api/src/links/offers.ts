import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { secondChanceOffers, users } from "@/db/schema";
import type { OfferRecord } from "@/funnel/secondChance";

type Executor = Pick<ReturnType<typeof db>, "select">;

export const inCurrentEpoch = sql`${secondChanceOffers.epoch} = (select ${users.funnelEpoch} from ${users} where ${users.id} = ${secondChanceOffers.userId})`;

export const currentEpochOf = (userId: number) =>
  sql<number>`(select ${users.funnelEpoch} from ${users} where ${users.id} = ${userId})`;

const offerColumns = {
  userId: secondChanceOffers.userId,
  occasion: secondChanceOffers.occasion,
  dueAt: secondChanceOffers.dueAt,
  answer: secondChanceOffers.answer,
  reopened: sql<boolean>`${secondChanceOffers.grantedLinkId} is not null`,
};

export async function offerHistory(executor: Executor, userId: number): Promise<OfferRecord[]> {
  return executor
    .select(offerColumns)
    .from(secondChanceOffers)
    .where(and(eq(secondChanceOffers.userId, userId), inCurrentEpoch))
    .orderBy(asc(secondChanceOffers.occasion));
}

export async function offerHistories(executor: Executor, userIds: number[]): Promise<Map<number, OfferRecord[]>> {
  const histories = new Map<number, OfferRecord[]>(userIds.map((userId) => [userId, []]));
  if (userIds.length === 0) return histories;
  const rows = await executor
    .select(offerColumns)
    .from(secondChanceOffers)
    .where(and(inArray(secondChanceOffers.userId, userIds), inCurrentEpoch))
    .orderBy(asc(secondChanceOffers.occasion));
  for (const row of rows) histories.get(row.userId)?.push(row);
  return histories;
}
