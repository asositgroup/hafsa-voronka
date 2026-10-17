import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { assigneeLabel, type LeadAction } from "./card";
import { bumpLeadVersion, kickLeadNotifier } from "./notifier";

export type LeadActor = { id: number; name: string; username?: string };

export const leadActionReplies = {
  claimed: "Lid sizga biriktirildi",
  won: "Muvaffaqiyatli deb belgilandi",
  lost: "Yo'qotilgan deb belgilandi",
  notFound: "Lid topilmadi",
  alreadyYours: "Bu lid allaqachon sizda",
  takenBy: (who: string) => `Bu lid ${who}ga biriktirilgan`,
  claimFirst: "Avval «Men olaman» tugmasini bosing",
  closed: "Bu lid bo'yicha natija allaqachon belgilangan",
};

async function explainRefusal(leadId: number, action: LeadAction, actor: LeadActor) {
  const [lead] = await db().select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return leadActionReplies.notFound;
  if (lead.outcome) return leadActionReplies.closed;
  if (lead.assigneeTelegramId === null) return leadActionReplies.claimFirst;
  if (lead.assigneeTelegramId === actor.id) {
    return action === "claim" ? leadActionReplies.alreadyYours : leadActionReplies.closed;
  }
  return leadActionReplies.takenBy(assigneeLabel(lead));
}

export async function applyLeadAction(leadId: number, action: LeadAction, actor: LeadActor) {
  const now = new Date();
  const [updated] =
    action === "claim"
      ? await db()
          .update(leads)
          .set({
            assigneeTelegramId: actor.id,
            assigneeName: actor.name.slice(0, 60),
            assigneeUsername: actor.username ?? null,
            assignedAt: now,
            ...bumpLeadVersion,
          })
          .where(and(eq(leads.id, leadId), isNull(leads.assigneeTelegramId), isNull(leads.outcome)))
          .returning({ id: leads.id })
      : await db()
          .update(leads)
          .set({ outcome: action, outcomeAt: now, ...bumpLeadVersion })
          .where(
            and(eq(leads.id, leadId), isNull(leads.outcome), eq(leads.assigneeTelegramId, actor.id)),
          )
          .returning({ id: leads.id });

  if (!updated) return { ok: false as const, reply: await explainRefusal(leadId, action, actor) };

  kickLeadNotifier();
  const reply = action === "claim" ? leadActionReplies.claimed : leadActionReplies[action];
  return { ok: true as const, reply };
}
