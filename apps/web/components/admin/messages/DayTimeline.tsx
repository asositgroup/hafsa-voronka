"use client";

import { compareTimeline, isSameMoment, type FunnelSegment, type MessageTemplate, TEMPLATE_DAYS } from "@funnel/shared";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import type { VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { Button } from "@/components/admin/ui/Button";
import { Segmented } from "@/components/admin/ui/Segmented";
import { PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

export function dayCounts(items: MessageTemplate[]): number[] {
  const counts = Array.from({ length: TEMPLATE_DAYS }, () => 0);
  for (const item of items) {
    if (item.isActive && item.day >= 1 && item.day <= TEMPLATE_DAYS) counts[item.day - 1] += 1;
  }
  return counts;
}

type DayTimelineProps = {
  segment: FunnelSegment;
  items: MessageTemplate[];
  videoMarks: VideoMarks;
  day: number;
  onDayChange: (day: number) => void;
  onAdd: (day: number) => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
  onMove: (group: MessageTemplate[], index: number, direction: -1 | 1) => void;
};

export function DayTimeline({ segment, items, videoMarks, day, onDayChange, onAdd, onEdit, onToggle, onMove }: DayTimelineProps) {
  const counts = dayCounts(items);
  const dayItems = items.filter((item) => item.segment === segment && item.day === day).sort(compareTimeline);
  const tabs = counts.map((count, index) => ({
    value: index + 1,
    label: copy.dayLabel.replace("{n}", String(index + 1)),
    sub: count,
  }));

  return (
    <section className="flex flex-col gap-4">
      <div className="-mx-4 overflow-x-auto px-4">
        <Segmented label={copy.dayTabs} role="tablist" scroll items={tabs} value={day} onChange={onDayChange} />
      </div>

      <p className="m-0 text-sm text-qalam">{copy.restartNote}</p>

      {dayItems.length === 0 ? (
        <p className="m-0 rounded-[16px] bg-white px-4 py-6 text-center text-sm text-qalam">{copy.emptyDay}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
          {dayItems.map((item, index) => {
            const sameMoment = (other: MessageTemplate | undefined) => other !== undefined && isSameMoment(other, item);
            return (
              <MessageCard
                key={item.id}
                item={item}
                videoMarks={videoMarks}
                onEdit={() => onEdit(item)}
                onToggle={(isActive) => onToggle(item, isActive)}
                onMoveUp={sameMoment(dayItems[index - 1]) ? () => onMove(dayItems, index, -1) : undefined}
                onMoveDown={sameMoment(dayItems[index + 1]) ? () => onMove(dayItems, index, 1) : undefined}
              />
            );
          })}
        </ul>
      )}

      <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAdd(day)}>
        {copy.addForDay.replace("{n}", String(day))}
      </Button>
    </section>
  );
}
