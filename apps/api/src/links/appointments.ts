import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type User, users, watchAppointments } from "@/db/schema";
import { isSlotOpen, preReminderAt } from "@/funnel/laterPicker";
import { logEvent } from "@/funnel/users";
import { refreshUserLeadCards } from "@/leads/service";
import { cancelPendingAppointments } from "./appointmentStore";
import { lessonState } from "./service";

type Reader = Pick<ReturnType<typeof db>, "select">;

export type LaterContext =
  | { purpose: "reopen"; expiresAt: null }
  | { purpose: "remind"; expiresAt: Date | null };

export type ScheduleResult = "scheduled" | "unavailable" | "closed";

export async function laterContextFor(executor: Reader, user: User, now: Date): Promise<LaterContext | null> {
  if (user.registeredAt === null || user.wroteAdminAt !== null || user.botBlocked) return null;
  const state = await lessonState(executor, user, now);
  if (state.closed) return { purpose: "reopen", expiresAt: null };
  const live = user.linkExpiresAt !== null && user.linkExpiresAt.getTime() > now.getTime();
  return { purpose: "remind", expiresAt: live ? user.linkExpiresAt : null };
}

export async function scheduleAppointment(userId: number, chosenAt: Date, now = new Date()): Promise<ScheduleResult> {
  const result = await db().transaction(async (tx): Promise<ScheduleResult> => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user) return "closed";
    const context = await laterContextFor(tx, user, now);
    if (!context) return "closed";
    if (!isSlotOpen({ now, purpose: context.purpose, expiresAt: context.expiresAt }, chosenAt)) return "unavailable";
    await cancelPendingAppointments(tx, userId, now);
    await tx.insert(watchAppointments).values({
      userId,
      offerId: null,
      purpose: context.purpose,
      chosenAt,
      preRemindAt: context.purpose === "reopen" ? preReminderAt(chosenAt, now) : null,
      createdAt: now,
    });
    return "scheduled";
  });
  if (result !== "scheduled") return result;
  await logEvent("later_scheduled", { userId, meta: { chosenAt: chosenAt.toISOString() } });
  await refreshUserLeadCards(userId).catch((error) => console.error("Lead card refresh failed:", error));
  return result;
}
