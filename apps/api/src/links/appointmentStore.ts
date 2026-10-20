import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AppointmentPurpose } from "@funnel/shared";
import { db } from "@/db";
import { watchAppointments } from "@/db/schema";

type Reader = Pick<ReturnType<typeof db>, "select">;
type Writer = Pick<ReturnType<typeof db>, "update">;

const pending = and(isNull(watchAppointments.firedAt), isNull(watchAppointments.cancelledAt));

export async function pendingAppointmentUserIds(executor: Reader, userIds: number[]): Promise<Set<number>> {
  if (userIds.length === 0) return new Set();
  const rows = await executor
    .select({ userId: watchAppointments.userId })
    .from(watchAppointments)
    .where(and(pending, inArray(watchAppointments.userId, userIds)));
  return new Set(rows.map((row) => row.userId));
}

export async function pendingAppointmentOf(executor: Reader, userId: number) {
  const [appointment] = await executor
    .select()
    .from(watchAppointments)
    .where(and(pending, eq(watchAppointments.userId, userId)))
    .limit(1);
  return appointment ?? null;
}

export async function cancelPendingAppointments(
  executor: Writer,
  userId: number,
  now: Date,
  purposes: readonly AppointmentPurpose[] = ["reopen", "remind"],
): Promise<number> {
  const cancelled = await executor
    .update(watchAppointments)
    .set({ cancelledAt: now })
    .where(and(pending, eq(watchAppointments.userId, userId), inArray(watchAppointments.purpose, [...purposes])))
    .returning({ id: watchAppointments.id });
  return cancelled.length;
}
