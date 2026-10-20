import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { type BotAdminInput, type BotAdminInputKind, botAdminInputs, type VideoMarkField, videos } from "@/db/schema";
import { keyFromPublicUrl, r2 } from "@/storage/r2";

const INPUT_TTL_MS = 30 * 60 * 1000;

export function isShortMidUpload(input: BotAdminInput) {
  return input.shortFileUniqueId !== null && input.shortFileUrl === null;
}

export async function discardUnusedFile(url: string | null) {
  const store = r2();
  const key = url ? keyFromPublicUrl(url) : null;
  if (!store || !url || !key) return;
  const [used] = await db()
    .select({ id: videos.id })
    .from(videos)
    .where(or(eq(videos.fileUrl, url), eq(videos.shortOfferVideoUrl, url)))
    .limit(1);
  if (used) return;
  await store.deleteObject(key).catch((error: unknown) => {
    console.error("Failed to delete unused bot file", key, error);
  });
}

export async function clearInput(adminTelegramId: number) {
  const [removed] = await db()
    .delete(botAdminInputs)
    .where(eq(botAdminInputs.adminTelegramId, adminTelegramId))
    .returning();
  if (removed) await discardUnusedFile(removed.shortFileUrl);
  return removed;
}

export async function pendingInputOf(adminTelegramId: number): Promise<BotAdminInput | undefined> {
  const [input] = await db()
    .select()
    .from(botAdminInputs)
    .where(eq(botAdminInputs.adminTelegramId, adminTelegramId))
    .limit(1);
  if (!input) return undefined;
  if (!isShortMidUpload(input) && Date.now() - input.updatedAt.getTime() > INPUT_TTL_MS) {
    await clearInput(adminTelegramId);
    return undefined;
  }
  return input;
}

export async function startInput(
  adminTelegramId: number,
  kind: BotAdminInputKind,
  videoId: number,
  mark: VideoMarkField | null = null,
) {
  const previous = await pendingInputOf(adminTelegramId);
  const values = {
    kind,
    videoId,
    mark,
    shortFileUniqueId: null,
    shortDuration: null,
    shortFileUrl: null,
    updatedAt: new Date(),
  };
  await db()
    .insert(botAdminInputs)
    .values({ adminTelegramId, ...values })
    .onConflictDoUpdate({ target: botAdminInputs.adminTelegramId, set: values });
  if (previous) await discardUnusedFile(previous.shortFileUrl);
}

export async function clearIdleInput(adminTelegramId: number) {
  const [removed] = await db()
    .delete(botAdminInputs)
    .where(and(eq(botAdminInputs.adminTelegramId, adminTelegramId), isNull(botAdminInputs.shortFileUniqueId)))
    .returning();
  return removed;
}

function shortInputOf(adminTelegramId: number) {
  return and(eq(botAdminInputs.adminTelegramId, adminTelegramId), eq(botAdminInputs.kind, "shortVideo"));
}

export async function setShortFile(adminTelegramId: number, fileUniqueId: string, duration: number | null) {
  const [previous] = await db().select().from(botAdminInputs).where(shortInputOf(adminTelegramId)).limit(1);
  if (!previous) return undefined;
  const [input] = await db()
    .update(botAdminInputs)
    .set({ shortFileUniqueId: fileUniqueId, shortDuration: duration, shortFileUrl: null, updatedAt: new Date() })
    .where(shortInputOf(adminTelegramId))
    .returning();
  await discardUnusedFile(previous.shortFileUrl);
  return input;
}

export async function completeShortUpload(adminTelegramId: number, fileUniqueId: string, fileUrl: string) {
  const [input] = await db()
    .update(botAdminInputs)
    .set({ shortFileUrl: fileUrl, updatedAt: new Date() })
    .where(and(shortInputOf(adminTelegramId), eq(botAdminInputs.shortFileUniqueId, fileUniqueId)))
    .returning();
  return input;
}

export async function failShortUpload(adminTelegramId: number, fileUniqueId: string) {
  const [input] = await db()
    .update(botAdminInputs)
    .set({ shortFileUniqueId: null, shortDuration: null, shortFileUrl: null, updatedAt: new Date() })
    .where(and(shortInputOf(adminTelegramId), eq(botAdminInputs.shortFileUniqueId, fileUniqueId)))
    .returning();
  return input;
}

export async function setShortDuration(adminTelegramId: number, duration: number) {
  const [input] = await db()
    .update(botAdminInputs)
    .set({ shortDuration: duration, updatedAt: new Date() })
    .where(and(shortInputOf(adminTelegramId), isNotNull(botAdminInputs.shortFileUniqueId)))
    .returning();
  return input;
}

export async function claimFinishedShort(adminTelegramId: number) {
  const [input] = await db()
    .delete(botAdminInputs)
    .where(
      and(
        shortInputOf(adminTelegramId),
        isNotNull(botAdminInputs.shortFileUrl),
        isNotNull(botAdminInputs.shortDuration),
      ),
    )
    .returning();
  return input;
}

export async function resetInterruptedShortUploads() {
  return db()
    .update(botAdminInputs)
    .set({ shortFileUniqueId: null, shortDuration: null, updatedAt: new Date() })
    .where(and(isNotNull(botAdminInputs.shortFileUniqueId), isNull(botAdminInputs.shortFileUrl)))
    .returning({ adminTelegramId: botAdminInputs.adminTelegramId });
}
