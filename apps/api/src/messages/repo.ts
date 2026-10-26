import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  type FunnelSegment,
  type MessageTemplate,
  type MessageTemplateInput,
  normalizeAttempts,
  normalizeStatuses,
} from "@funnel/shared";
import { db } from "@/db";
import { type MessageTemplateRow, messageTemplates, segmentRuns, sentMessages } from "@/db/schema";

export class StaleOrderError extends Error {
  constructor() {
    super("stale_order");
  }
}

type Executor = Pick<ReturnType<typeof db>, "select" | "insert" | "update">;

export function toTemplate(row: MessageTemplateRow): MessageTemplate {
  return {
    id: row.id,
    segment: row.segment,
    day: row.day,
    position: row.position,
    text: row.text,
    media: row.mediaType && row.mediaFileId ? { type: row.mediaType, fileId: row.mediaFileId } : null,
    minute: row.timingValue,
    buttons: row.buttons,
    isActive: row.isActive,
    statuses: row.statuses,
    attempts: row.attempts,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function columns(input: MessageTemplateInput) {
  return {
    text: input.text,
    mediaType: input.media?.type ?? null,
    mediaFileId: input.media?.fileId ?? null,
    timingValue: input.minute,
    buttons: input.buttons,
    isActive: input.isActive,
    statuses: normalizeStatuses(input.segment, input.statuses),
    attempts: normalizeAttempts(input.segment, input.attempts),
  };
}

async function nextPosition(executor: Executor, segment: FunnelSegment, day: number) {
  const [row] = await executor
    .select({ next: sql<number>`coalesce(max(${messageTemplates.position}), -1) + 1` })
    .from(messageTemplates)
    .where(and(eq(messageTemplates.segment, segment), eq(messageTemplates.day, day), isNull(messageTemplates.deletedAt)));
  return Number(row.next);
}

export async function chainTemplateRows(run?: { id: number; segment: FunnelSegment }) {
  const sentInRuns = db()
    .select({ id: sentMessages.templateId })
    .from(sentMessages)
    .innerJoin(segmentRuns, eq(segmentRuns.id, sentMessages.segmentRunId))
    .where(run === undefined ? isNull(segmentRuns.endedAt) : eq(segmentRuns.id, run.id));
  return db()
    .select()
    .from(messageTemplates)
    .where(
      and(
        run === undefined ? undefined : eq(messageTemplates.segment, run.segment),
        or(
          and(eq(messageTemplates.isActive, true), isNull(messageTemplates.deletedAt)),
          inArray(messageTemplates.id, sentInRuns),
        ),
      ),
    );
}

export async function listTemplates(segment: FunnelSegment) {
  const rows = await db()
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.segment, segment), isNull(messageTemplates.deletedAt)))
    .orderBy(asc(messageTemplates.day), asc(messageTemplates.position), asc(messageTemplates.id));
  return rows.map(toTemplate);
}

export async function findTemplate(id: number) {
  const [row] = await db()
    .select()
    .from(messageTemplates)
    .where(and(eq(messageTemplates.id, id), isNull(messageTemplates.deletedAt)));
  return row ? toTemplate(row) : null;
}

export async function createTemplate(input: MessageTemplateInput) {
  return db().transaction(async (tx) => {
    const position = await nextPosition(tx, input.segment, input.day);
    const [row] = await tx
      .insert(messageTemplates)
      .values({ segment: input.segment, day: input.day, position, ...columns(input) })
      .returning();
    return toTemplate(row);
  });
}

export async function updateTemplate(id: number, input: MessageTemplateInput) {
  return db().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(messageTemplates)
      .where(and(eq(messageTemplates.id, id), isNull(messageTemplates.deletedAt)))
      .for("update");
    if (!current) return null;
    const moved = current.segment !== input.segment || current.day !== input.day;
    const position = moved ? await nextPosition(tx, input.segment, input.day) : current.position;
    const [row] = await tx
      .update(messageTemplates)
      .set({ segment: input.segment, day: input.day, position, ...columns(input), updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return toTemplate(row);
  });
}

export async function setActive(id: number, isActive: boolean) {
  const [row] = await db()
    .update(messageTemplates)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(messageTemplates.id, id), isNull(messageTemplates.deletedAt)))
    .returning();
  return row ? toTemplate(row) : null;
}

export async function softDelete(id: number) {
  const [row] = await db()
    .update(messageTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(messageTemplates.id, id), isNull(messageTemplates.deletedAt)))
    .returning({ id: messageTemplates.id });
  return row !== undefined;
}

export async function reorder(segment: FunnelSegment, day: number, ids: number[]) {
  await db().transaction(async (tx) => {
    const live = await tx
      .select({ id: messageTemplates.id })
      .from(messageTemplates)
      .where(
        and(eq(messageTemplates.segment, segment), eq(messageTemplates.day, day), isNull(messageTemplates.deletedAt)),
      )
      .for("update");
    const liveIds = new Set(live.map((row) => row.id));
    if (ids.length !== liveIds.size || new Set(ids).size !== ids.length || ids.some((id) => !liveIds.has(id))) {
      throw new StaleOrderError();
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(messageTemplates).set({ position }).where(eq(messageTemplates.id, id));
    }
  });
}
