import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { type BotVideoDraft, type BotVideoStep, botVideoDrafts } from "@/db/schema";

export async function findDraft(id: number): Promise<BotVideoDraft | undefined> {
  const [draft] = await db().select().from(botVideoDrafts).where(eq(botVideoDrafts.id, id)).limit(1);
  return draft;
}

export async function updateDraftAtStep(
  id: number,
  expectedStep: BotVideoStep,
  patch: Partial<typeof botVideoDrafts.$inferInsert>,
): Promise<BotVideoDraft | undefined> {
  const [draft] = await db()
    .update(botVideoDrafts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(botVideoDrafts.id, id), eq(botVideoDrafts.step, expectedStep)))
    .returning();
  return draft;
}
