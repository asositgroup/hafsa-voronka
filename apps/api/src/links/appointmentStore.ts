import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AppointmentPurpose } from "@funnel/shared";
import { db } from "@/db";
import { watchAppointments } from "@/db/schema";

type Writer = Pick<ReturnType<typeof db>, "update">;

const pending = and(isNull(watchAppointments.firedAt), isNull(watchAppointments.cancelledAt));

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
