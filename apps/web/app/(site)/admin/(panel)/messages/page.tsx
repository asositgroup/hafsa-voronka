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
import { MessageCard } from "@/components/admin/messages/MessageCard";
import { MessageEditor } from "@/components/admin/messages/MessageEditor";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { Section } from "@/components/admin/ui/Section";
import { Segmented } from "@/components/admin/ui/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/ui/States";
import { Stepper } from "@/components/admin/ui/Stepper";
import { PlusIcon } from "@/components/icons";
import { fetchMessages, reorderMessages, setMessageActive } from "@/lib/admin/messages";
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

  function retry() {
    setFailed(false);
    void load(segment);
  }

  useEffect(() => {
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
  }, [segment]);

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

  const steps = funnelSegments.map((value) => ({ value, label: adminUz.segments[value].label, hint: adminUz.segments[value].hint }));
  const dayItemsLabel = copy.dayLabel.replace("{n}", String(day));
  const activeCount = loaded?.items.filter((item) => item.isActive).length ?? 0;

  const addButton = (
    <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ item: null })}>
      {copy.addMessage}
    </Button>
  );

  return (
    <Page width="narrow">
      <PageHeader title={adminUz.pages.messages.title} description={adminUz.pages.messages.description} />

      <Section>
        <Stepper label={copy.segmentLabel} steps={steps} value={segment} onChange={selectSegment} />
        <p className="m-0 border-t border-chiziq pt-3 text-[13px] text-qalam">{adminUz.segmentsNote}</p>
        {loaded && (
          <p className="m-0 text-[13px] font-medium text-siyoh">
            {copy.countSummary.replace("{total}", String(loaded.items.length)).replace("{active}", String(activeCount))}
          </p>
        )}
      </Section>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-siyoh">{copy.dayHeading}</span>
        <Segmented
          label={copy.dayHeading}
          role="tablist"
          fill
          value={day}
          onChange={setDay}
          items={days.map((value) => {
            const count = loaded?.items.filter((item) => item.day === value).length ?? 0;
            return { value, label: value, sub: loaded && count > 0 ? count : "–" };
          })}
        />
      </div>

      {notice && (
        <Notice tone="attention" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {failed && <ErrorState onRetry={retry} />}
      {!loaded && !failed && <LoadingState variant="list" rows={3} />}

      {loaded && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <h2 className="m-0 text-[17px] font-semibold text-siyoh">{dayItemsLabel}</h2>
              <span className="text-[13px] text-qalam">{copy.listCount.replace("{n}", String(dayItems.length))}</span>
            </div>
            <div className="hidden sm:block">{addButton}</div>
          </div>

          {dayItems.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle.replace("{n}", String(day))}
              description={copy.emptyHint}
              action={
                <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ item: null })}>
                  {copy.addMessage}
                </Button>
              }
            />
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
                <SortableContext items={dayItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3">
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
              <div className="sm:hidden">
                <Button variant="secondary" block icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ item: null })}>
                  {copy.addMessage}
                </Button>
              </div>
            </>
          )}
        </section>
      )}

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
    </Page>
  );
}
