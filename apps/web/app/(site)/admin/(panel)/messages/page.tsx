"use client";

import { useCallback, useEffect, useState } from "react";
import {
  compareTimeline,
  EXPIRY_TIMELINE_GROUP,
  type FunnelSegment,
  funnelSegments,
  linkBoundSegments,
  type MessageTemplate,
  timelineGroupKey,
  type TimelineGroupKey,
  timelineSortKey,
} from "@funnel/shared";
import { AudienceTabs } from "@/components/admin/messages/AudienceTabs";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import { MessageEditor, type MessagePreset } from "@/components/admin/messages/MessageEditor";
import { ScheduleSimulator } from "@/components/admin/messages/ScheduleSimulator";
import { Button } from "@/components/admin/ui/Button";
import { Notice } from "@/components/admin/ui/Notice";
import { Page, PageHeader } from "@/components/admin/ui/Page";
import { EmptyState, ErrorState, LoadingState } from "@/components/admin/ui/States";
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

type Editing = { item: MessageTemplate | null; preset?: MessagePreset } | null;

const nightNoticePreset: MessagePreset = {
  text: copy.nightNotice.defaultText,
  timing: { type: "night_notice", value: 0 },
};

type TimelineGroup = { key: TimelineGroupKey; items: MessageTemplate[] };

function buildTimeline(items: MessageTemplate[]): TimelineGroup[] {
  const groups = new Map<TimelineGroupKey, MessageTemplate[]>();
  for (const item of [...items].sort(compareTimeline)) {
    const key = timelineGroupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const dayGroups = [...groups.entries()]
    .filter((entry): entry is [number, MessageTemplate[]] => entry[0] !== EXPIRY_TIMELINE_GROUP)
    .sort((a, b) => a[0] - b[0]);
  const expiry = groups.get(EXPIRY_TIMELINE_GROUP);
  return [...dayGroups.map(([key, list]): TimelineGroup => ({ key, items: list })), ...(expiry ? [{ key: EXPIRY_TIMELINE_GROUP, items: expiry } satisfies TimelineGroup] : [])];
}

function byPosition(items: MessageTemplate[]) {
  return [...items].sort((a, b) => a.position - b.position || a.id - b.id);
}

export default function AdminMessagesPage() {
  const [segment, setSegment] = useState<FunnelSegment>("A");
  const [cache, setCache] = useState<Partial<Record<FunnelSegment, Loaded>>>({});
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  const loaded = cache[segment] ?? null;

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
    return () => {
      active = false;
    };
  }, []);

  function selectSegment(next: FunnelSegment) {
    if (next === segment) return;
    setNotice(null);
    setSegment(next);
  }

  const counts: Partial<Record<FunnelSegment, number>> = {};
  for (const key of funnelSegments) {
    const entry = cache[key];
    if (entry) counts[key] = entry.items.length;
  }

  const timeline = loaded ? buildTimeline(loaded.items) : [];
  const offerNightNotice =
    loaded !== null &&
    linkBoundSegments.includes(segment) &&
    !loaded.items.some((item) => item.timing.type === "night_notice");

  async function move(group: MessageTemplate[], index: number, direction: -1 | 1) {
    if (!loaded) return;
    const target = group[index + direction];
    const current = group[index];
    if (!target || !current) return;
    const day = current.day;
    const dayList = byPosition(loaded.items.filter((item) => item.day === day));
    const from = dayList.findIndex((item) => item.id === current.id);
    const to = dayList.findIndex((item) => item.id === target.id);
    if (from < 0 || to < 0) return;

    const reordered = [...dayList];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const positioned = reordered.map((item, position) => ({ ...item, position }));
    const previous = loaded;
    patch(segment, (current) => ({ ...current, items: [...current.items.filter((item) => item.day !== day), ...positioned] }));
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
    if (!loaded) return;
    const apply = (value: boolean) =>
      patch(segment, (current) => ({
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

  function deleted(id: number) {
    patch(segment, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== id) }));
    setEditing(null);
  }

  const count = loaded ? copy.count.replace("{n}", String(loaded.items.length)) : null;

  return (
    <Page width="narrow">
      <PageHeader
        title={adminUz.pages.messages.title}
        description={adminUz.pages.messages.description}
      />

      <AudienceTabs value={segment} counts={counts} onChange={selectSegment} />

      {notice && (
        <Notice tone="attention" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {failed && !loaded && <ErrorState onRetry={retry} />}
      {!loaded && !failed && <LoadingState variant="list" rows={3} />}

      {loaded && (
        <section className="flex flex-col gap-4">
          {loaded.items.length === 0 ? (
            <EmptyState
              title={copy.emptyTitle}
              description={copy.emptyHints[segment]}
              action={
                <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ item: null })}>
                  {copy.addMessage}
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-sm text-qalam">{count}</p>
                <Button
                  variant="secondary"
                  icon={<PlusIcon className="h-4 w-4" />}
                  onClick={() => setEditing({ item: null })}
                >
                  {copy.addMessage}
                </Button>
              </div>
              {segment === "A" && <ScheduleSimulator segment={segment} items={loaded.items} />}
              {timeline.map((group) => (
                <section key={group.key} aria-labelledby={`group-${group.key}`} className="flex flex-col gap-2">
                  <h2 id={`group-${group.key}`} className="m-0 px-1 text-sm font-semibold text-siyoh">
                    {group.key === EXPIRY_TIMELINE_GROUP ? copy.expiryGroup : copy.dayLabel.replace("{n}", String(group.key))}
                  </h2>
                  <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
                    {group.key === EXPIRY_TIMELINE_GROUP && offerNightNotice && (
                      <li className="px-2 py-2 sm:px-3">
                        <button
                          type="button"
                          onClick={() => setEditing({ item: null, preset: nightNoticePreset })}
                          className="flex w-full items-start gap-3 rounded-[10px] border border-dashed border-chiziq px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
                        >
                          <PlusIcon className="mt-0.5 h-4 w-4 shrink-0 text-qalam" />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-semibold text-siyoh">{copy.nightNotice.add}</span>
                            <span className="text-[13px] text-qalam">{copy.nightNotice.addHint}</span>
                          </span>
                        </button>
                      </li>
                    )}
                    {group.items.map((item, index) => {
                      const sameMoment = (other: MessageTemplate | undefined) =>
                        other !== undefined && timelineSortKey(other) === timelineSortKey(item);
                      const previousItem = group.items[index - 1];
                      const nextItem = group.items[index + 1];
                      return (
                        <MessageCard
                          key={item.id}
                          item={item}
                          onEdit={() => setEditing({ item })}
                          onToggle={(isActive) => void toggle(item, isActive)}
                          onMoveUp={sameMoment(previousItem) ? () => void move(group.items, index, -1) : undefined}
                          onMoveDown={sameMoment(nextItem) ? () => void move(group.items, index, 1) : undefined}
                        />
                      );
                    })}
                  </ul>
                </section>
              ))}
            </>
          )}
        </section>
      )}

      {loaded && editing && (
        <MessageEditor
          key={editing.item?.id ?? "new"}
          segment={segment}
          item={editing.item}
          preset={editing.preset}
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
