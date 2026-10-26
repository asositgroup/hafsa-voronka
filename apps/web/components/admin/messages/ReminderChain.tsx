"use client";

import { compareTimeline, isSameMoment, type MessageTemplate } from "@funnel/shared";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import type { MessagePreset } from "@/components/admin/messages/MessageEditor";
import type { VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/States";
import { PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

type TimelineGroup = { day: number; items: MessageTemplate[] };

function buildTimeline(items: MessageTemplate[]): TimelineGroup[] {
  const groups = new Map<number, MessageTemplate[]>();
  for (const item of [...items].sort(compareTimeline)) {
    groups.set(item.day, [...(groups.get(item.day) ?? []), item]);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, items: list }));
}

type ReminderChainProps = {
  items: MessageTemplate[];
  videoMarks: VideoMarks;
  onAdd: (preset?: MessagePreset) => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
  onMove: (group: MessageTemplate[], index: number, direction: -1 | 1) => void;
};

export function ReminderChain({ items, videoMarks, onAdd, onEdit, onToggle, onMove }: ReminderChainProps) {
  const timeline = buildTimeline(items);

  if (items.length === 0) {
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
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-qalam">{copy.count.replace("{n}", String(items.length))}</p>
        <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAdd()}>
          {copy.addMessage}
        </Button>
      </div>

      {timeline.map((group) => (
        <section key={group.day} aria-labelledby={`group-${group.day}`} className="flex flex-col gap-2">
          <h2 id={`group-${group.day}`} className="m-0 px-1 text-sm font-semibold text-siyoh">
            {copy.dayLabel.replace("{n}", String(group.day))}
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
            {group.items.map((item, index) => {
              const sameMoment = (other: MessageTemplate | undefined) =>
                other !== undefined && isSameMoment(other, item);
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
