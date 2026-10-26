"use client";

import {
  compareTimeline,
  EXPIRY_TIMELINE_GROUP,
  type FunnelSegment,
  linkBoundSegments,
  type MessageTemplate,
  timelineGroupKey,
  type TimelineGroupKey,
  timelineSortKey,
} from "@funnel/shared";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import type { MessagePreset } from "@/components/admin/messages/MessageEditor";
import { NightRules } from "@/components/admin/messages/NightRules";
import { chainItems } from "@/components/admin/messages/StageOverview";
import type { VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/States";
import { PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

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
  return [
    ...dayGroups.map(([key, list]): TimelineGroup => ({ key, items: list })),
    ...(expiry ? [{ key: EXPIRY_TIMELINE_GROUP, items: expiry } satisfies TimelineGroup] : []),
  ];
}

type ReminderChainProps = {
  segment: FunnelSegment;
  items: MessageTemplate[];
  videoMarks: VideoMarks;
  onAdd: (preset?: MessagePreset) => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
  onMove: (group: MessageTemplate[], index: number, direction: -1 | 1) => void;
};

export function ReminderChain({ segment, items, videoMarks, onAdd, onEdit, onToggle, onMove }: ReminderChainProps) {
  const chain = chainItems(items);
  const notice = items.find((item) => item.timing.type === "night_notice");
  const timeline = buildTimeline(chain);

  if (chain.length === 0 && !notice) {
    return (
      <EmptyState
        title={copy.emptyTitle}
        description={copy.emptyHint}
        action={
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAdd()}>
            {copy.writeFirst}
          </Button>
        }
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {linkBoundSegments.includes(segment) && (
        <NightRules notice={notice} onCreate={() => onAdd(nightNoticePreset)} onEdit={onEdit} onToggle={onToggle} />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-qalam">{copy.count.replace("{n}", String(chain.length))}</p>
        <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAdd()}>
          {copy.addMessage}
        </Button>
      </div>

      {timeline.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`} className="flex flex-col gap-2">
          <h2 id={`group-${group.key}`} className="m-0 px-1 text-sm font-semibold text-siyoh">
            {group.key === EXPIRY_TIMELINE_GROUP ? copy.expiryGroup : copy.dayLabel.replace("{n}", String(group.key))}
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
            {group.items.map((item, index) => {
              const sameMoment = (other: MessageTemplate | undefined) =>
                other !== undefined && timelineSortKey(other) === timelineSortKey(item);
              return (
                <MessageCard
                  key={item.id}
                  item={item}
                  videoMarks={videoMarks}
                  onEdit={() => onEdit(item)}
                  onToggle={(isActive) => onToggle(item, isActive)}
                  onMoveUp={sameMoment(group.items[index - 1]) ? () => onMove(group.items, index, -1) : undefined}
                  onMoveDown={sameMoment(group.items[index + 1]) ? () => onMove(group.items, index, 1) : undefined}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
