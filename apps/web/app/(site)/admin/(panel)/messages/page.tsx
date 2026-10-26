"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { defaultMinute, type FunnelSegment, funnelSegments, type MessageTemplate } from "@funnel/shared";
import { MessageEditor, type MessagePreset } from "@/components/admin/messages/MessageEditor";
import { DayTimeline } from "@/components/admin/messages/DayTimeline";
import { StageOverview } from "@/components/admin/messages/StageOverview";
import type { VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { buttonClass } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { ErrorState, LoadingState } from "@/components/admin/ui/States";
import { ChevronLeftIcon } from "@/components/icons";
import { fetchMessages, reorderMessages, setMessageActive } from "@/lib/admin/messages";
import { fetchSettings } from "@/lib/admin/settings";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

type Loaded = {
  items: MessageTemplate[];
  admins: { telegramId: number; label: string }[];
  mediaEnabled: boolean;
  prefillSupported: boolean;
  videoMarks: VideoMarks;
};

type Editing = { segment: FunnelSegment; item: MessageTemplate | null; preset?: MessagePreset } | null;

function parseStage(value: string | null): FunnelSegment | null {
  return funnelSegments.find((segment) => segment === value) ?? null;
}

function byPosition(items: MessageTemplate[]) {
  return [...items].sort((a, b) => a.position - b.position || a.id - b.id);
}

function AdminMessagesContent() {
  const stage = parseStage(useSearchParams().get("stage"));
  const [cache, setCache] = useState<Partial<Record<FunnelSegment, Loaded>>>({});
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [linkTtlHours, setLinkTtlHours] = useState<number | null>(null);
  const [shownStage, setShownStage] = useState(stage);
  const [day, setDay] = useState(1);

  if (shownStage !== stage) {
    setShownStage(stage);
    setNotice(null);
    setEditing(null);
    setDay(1);
  }

  const loaded = stage ? (cache[stage] ?? null) : null;
  const allLoaded = funnelSegments.every((segment) => cache[segment]);

  const patch = useCallback((target: FunnelSegment, change: (current: Loaded) => Loaded) => {
    setCache((current) => {
      const existing = current[target];
      return existing ? { ...current, [target]: change(existing) } : current;
    });
  }, []);

  const loadAll = useCallback(async (targets: readonly FunnelSegment[]) => {
    const results = await Promise.all(targets.map((target) => fetchMessages(target)));
    let anyFailed = false;
    const fresh: Partial<Record<FunnelSegment, Loaded>> = {};
    results.forEach((result, index) => {
      if (result.ok) fresh[targets[index]] = result.data;
      else anyFailed = true;
    });
    setCache((current) => ({ ...current, ...fresh }));
    setFailed(anyFailed);
  }, []);

  function retry() {
    setFailed(false);
    void loadAll(funnelSegments);
  }

  useEffect(() => {
    let active = true;
    void Promise.all(funnelSegments.map((target) => fetchMessages(target))).then((results) => {
      if (!active) return;
      const fresh: Partial<Record<FunnelSegment, Loaded>> = {};
      let anyFailed = false;
      results.forEach((result, index) => {
        if (result.ok) fresh[funnelSegments[index]] = result.data;
        else anyFailed = true;
      });
      setCache((current) => ({ ...current, ...fresh }));
      setFailed(anyFailed);
    });
    void fetchSettings().then((result) => {
      if (active && result.ok) setLinkTtlHours(result.settings.linkTtlHours);
    });
    return () => {
      active = false;
    };
  }, []);

  async function move(group: MessageTemplate[], index: number, direction: -1 | 1) {
    const target = group[index + direction];
    const current = group[index];
    if (!target || !current) return;
    const segment = current.segment;
    const previous = cache[segment];
    if (!previous) return;
    const day = current.day;
    const dayList = byPosition(previous.items.filter((item) => item.day === day));
    const from = dayList.findIndex((item) => item.id === current.id);
    const to = dayList.findIndex((item) => item.id === target.id);
    if (from < 0 || to < 0) return;

    const reordered = [...dayList];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const positioned = reordered.map((item, position) => ({ ...item, position }));
    patch(segment, (entry) => ({ ...entry, items: [...entry.items.filter((item) => item.day !== day), ...positioned] }));
    setNotice(null);

    const result = await reorderMessages(segment, day, positioned.map((item) => item.id));
    if (result.ok) return;
    patch(segment, () => previous);
    if (result.error === "stale_order") {
      setNotice(copy.reorderFailed);
      void loadAll([segment]);
    } else {
      setNotice(copy.errors.generic);
    }
  }

  async function toggle(item: MessageTemplate, isActive: boolean) {
    const apply = (value: boolean) =>
      patch(item.segment, (current) => ({
        ...current,
        items: current.items.map((entry) => (entry.id === item.id ? { ...entry, isActive: value } : entry)),
      }));
    apply(isActive);
    const result = await setMessageActive(item.id, isActive);
    if (!result.ok) {
      apply(!isActive);
      setNotice(copy.errors.generic);
    }
  }

  function saved(item: MessageTemplate) {
    setCache((current) => {
      const next = { ...current };
      for (const key of funnelSegments) {
        const entry = next[key];
        if (!entry) continue;
        const others = entry.items.filter((existing) => existing.id !== item.id);
        next[key] = { ...entry, items: item.segment === key ? [...others, item] : others };
      }
      return next;
    });
    setEditing(null);
  }

  function deleted(segment: FunnelSegment, id: number) {
    patch(segment, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== id) }));
    setEditing(null);
  }

  const items: Partial<Record<FunnelSegment, MessageTemplate[]>> = {};
  for (const key of funnelSegments) {
    const entry = cache[key];
    if (entry) items[key] = entry.items;
  }

  const editingSource = editing ? cache[editing.segment] : undefined;

  return (
    <Page width="narrow">
      {stage ? (
        <div className="flex flex-col gap-3">
          <Link href="/admin/messages" className={`${buttonClass({ variant: "ghost", size: "sm" })} -ml-3 self-start`}>
            <ChevronLeftIcon className="h-4 w-4" />
            {copy.stages.back}
          </Link>
          <PageHeader title={copy.stages.titles[stage]} description={adminUz.segments[stage].explanation} />
        </div>
      ) : (
        <PageHeader title={adminUz.pages.messages.title} description={adminUz.pages.messages.description} />
      )}

      {notice && (
        <Notice tone="attention" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {failed && (stage ? !loaded : !allLoaded) && <ErrorState onRetry={retry} />}

      {!stage && <StageOverview items={items} linkTtlHours={linkTtlHours} />}

      {stage && !loaded && !failed && <LoadingState variant="list" rows={3} />}

      {stage && loaded && (
        <DayTimeline
          segment={stage}
          items={loaded.items}
          videoMarks={loaded.videoMarks}
          day={day}
          onDayChange={setDay}
          onAdd={(targetDay) => setEditing({ segment: stage, item: null, preset: { day: targetDay, minute: defaultMinute(targetDay) } })}
          onEdit={(item) => setEditing({ segment: stage, item })}
          onToggle={(item, isActive) => void toggle(item, isActive)}
          onMove={(group, index, direction) => void move(group, index, direction)}
        />
      )}

      {editing && editingSource && (
        <MessageEditor
          key={editing.item?.id ?? `new-${editing.segment}-${day}`}
          segment={editing.segment}
          item={editing.item}
          preset={editing.preset}
          admins={editingSource.admins}
          mediaEnabled={editingSource.mediaEnabled}
          prefillSupported={editingSource.prefillSupported}
          videoMarks={editingSource.videoMarks}
          onSaved={saved}
          onDeleted={(id) => deleted(editing.segment, id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <AdminMessagesContent />
    </Suspense>
  );
}
