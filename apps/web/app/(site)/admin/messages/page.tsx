"use client";

import { useCallback, useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { type FunnelSegment, funnelSegments, type MessageTemplate, TEMPLATE_DAYS } from "@funnel/shared";
import { AdminNav } from "@/components/admin/AdminNav";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import { MessageEditor } from "@/components/admin/messages/MessageEditor";
import { fetchMessages, reorderMessages, setMessageActive } from "@/lib/admin/messages";
import { useAdminSession } from "@/lib/admin/useAdminSession";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

type Loaded = {
  items: MessageTemplate[];
  admins: { telegramId: number; label: string }[];
  mediaEnabled: boolean;
  prefillSupported: boolean;
};

type Editing = { item: MessageTemplate | null } | null;

const days = Array.from({ length: TEMPLATE_DAYS }, (_, index) => index + 1);

function byDayOrder(items: MessageTemplate[]) {
  return [...items].sort((a, b) => a.day - b.day || a.position - b.position || a.id - b.id);
}

export default function AdminMessagesPage() {
  const authorized = useAdminSession();
  const [segment, setSegment] = useState<FunnelSegment>("A");
  const [day, setDay] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async (target: FunnelSegment) => {
    const result = await fetchMessages(target);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setLoaded(result.data);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void fetchMessages(segment).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setLoaded(result.data);
    });
    return () => {
      active = false;
    };
  }, [authorized, segment]);

  function selectSegment(next: FunnelSegment) {
    if (next === segment) return;
    setLoaded(null);
    setNotice(null);
    setSegment(next);
  }

  const dayItems = loaded ? byDayOrder(loaded.items.filter((item) => item.day === day)) : [];

  async function onDragEnd(event: DragEndEvent) {
    if (!loaded || !event.over || event.active.id === event.over.id) return;
    const from = dayItems.findIndex((item) => item.id === event.active.id);
    const to = dayItems.findIndex((item) => item.id === event.over!.id);
    if (from < 0 || to < 0) return;

    const reordered = arrayMove(dayItems, from, to).map((item, position) => ({ ...item, position }));
    const previous = loaded;
    setLoaded({ ...loaded, items: [...loaded.items.filter((item) => item.day !== day), ...reordered] });
    setNotice(null);

    const result = await reorderMessages(segment, day, reordered.map((item) => item.id));
    if (result.ok) return;
    setLoaded(previous);
    if (result.error === "stale_order") {
      setNotice(copy.reorderFailed);
      void load(segment);
    } else {
      setNotice(copy.errors.generic);
    }
  }

  async function toggle(item: MessageTemplate, isActive: boolean) {
    if (!loaded) return;
    const apply = (value: boolean) =>
      setLoaded((current) =>
        current && { ...current, items: current.items.map((entry) => (entry.id === item.id ? { ...entry, isActive: value } : entry)) },
      );
    apply(isActive);
    const result = await setMessageActive(item.id, isActive);
    if (!result.ok) {
      apply(!isActive);
      setNotice(copy.errors.generic);
    }
  }

  function saved(item: MessageTemplate) {
    setLoaded((current) => {
      if (!current) return current;
      const others = current.items.filter((entry) => entry.id !== item.id);
      return { ...current, items: item.segment === segment ? [...others, item] : others };
    });
    setDay(item.day);
    setEditing(null);
  }

  function deleted(id: number) {
    setLoaded((current) => current && { ...current, items: current.items.filter((entry) => entry.id !== id) });
    setEditing(null);
  }

  return (
    <div className="min-h-screen bg-varaq text-siyoh">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <AdminNav />

        <div>
          <h1 className="m-0 text-[28px] font-bold leading-tight text-siyoh">{copy.title}</h1>
          <p className="m-0 mt-1 text-sm text-qalam">{copy.subtitle}</p>
        </div>

        <div role="tablist" aria-label={copy.segmentLabel} className="flex overflow-x-auto rounded-[12px] bg-white p-1">
          {funnelSegments.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === segment}
              onClick={() => selectSegment(value)}
              className={`shrink-0 whitespace-nowrap rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors ${
                value === segment ? "bg-siyoh text-varaq" : "text-qalam hover:text-siyoh"
              }`}
            >
              {copy.segments[value]}
            </button>
          ))}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {days.map((value) => {
            const count = loaded?.items.filter((item) => item.day === value).length ?? 0;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={value === day}
                onClick={() => setDay(value)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  value === day ? "bg-siyoh text-varaq" : "bg-white text-siyoh hover:bg-white/70"
                }`}
              >
                {copy.dayLabel.replace("{n}", String(value))}
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    value === day ? "bg-varaq/20 text-varaq" : "bg-varaq text-qalam"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {notice && (
          <p role="alert" className="m-0 rounded-[12px] bg-oltin/20 px-4 py-3 text-xs text-siyoh">
            {notice}
          </p>
        )}
        {failed && <p className="m-0 text-sm text-anor">{adminUz.common.error}</p>}
        {!loaded && !failed && <p className="m-0 py-16 text-center text-sm text-qalam">{adminUz.common.loading}</p>}

        {loaded && (
          <section className="flex flex-col gap-3">
            {dayItems.length === 0 ? (
              <p className="m-0 rounded-[14px] bg-white px-4 py-8 text-center text-sm text-qalam">{copy.emptyDay}</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
                <SortableContext items={dayItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {dayItems.map((item) => (
                      <MessageCard
                        key={item.id}
                        item={item}
                        onEdit={() => setEditing({ item })}
                        onToggle={(isActive) => void toggle(item, isActive)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <button
              type="button"
              onClick={() => setEditing({ item: null })}
              className="h-11 self-start rounded-[10px] bg-siyoh px-5 text-sm font-semibold text-varaq"
            >
              {copy.addMessage}
            </button>
          </section>
        )}
      </main>

      {loaded && editing && (
        <MessageEditor
          key={editing.item?.id ?? "new"}
          segment={segment}
          day={day}
          item={editing.item}
          admins={loaded.admins}
          mediaEnabled={loaded.mediaEnabled}
          prefillSupported={loaded.prefillSupported}
          onSaved={saved}
          onDeleted={deleted}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
