"use client";

import {
  compareTimeline,
  isSameMoment,
  type FunnelSegment,
  linkBoundSegments,
  type MessageTemplate,
  TEMPLATE_DAYS,
  triggerAllowed,
} from "@funnel/shared";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import type { VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { TriggerCard } from "@/components/admin/messages/TriggerCard";
import { Button } from "@/components/admin/ui/Button";
import { Segmented } from "@/components/admin/ui/Segmented";
import { PlusIcon } from "@/components/icons";
import { relativeAnchor } from "@/lib/admin/messageTiming";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;

export function dayCounts(items: MessageTemplate[]): number[] {
  const counts = Array.from({ length: TEMPLATE_DAYS }, () => 0);
  for (const item of items) {
    if (item.isActive && item.day >= 1 && item.day <= TEMPLATE_DAYS) counts[item.day - 1] += 1;
  }
  return counts;
}

function dayNote(segment: FunnelSegment, day: number) {
  if (day > 1 && !linkBoundSegments.includes(segment)) return copy.dayNotes.clock;
  return copy.dayNotes[relativeAnchor(segment, day)];
}

function byActiveFirst(a: MessageTemplate, b: MessageTemplate) {
  return Number(b.isActive) - Number(a.isActive) || a.id - b.id;
}

type DayTimelineProps = {
  segment: FunnelSegment;
  items: MessageTemplate[];
  videoMarks: VideoMarks;
  day: number;
  onDayChange: (day: number) => void;
  onAddReminder: (day: number) => void;
  onAddTrigger: (day: number) => void;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
  onMove: (group: MessageTemplate[], index: number, direction: -1 | 1) => void;
};

export function DayTimeline({
  segment,
  items,
  videoMarks,
  day,
  onDayChange,
  onAddReminder,
  onAddTrigger,
  onEdit,
  onToggle,
  onMove,
}: DayTimelineProps) {
  const counts = dayCounts(items);
  const dayItems = items.filter((item) => item.segment === segment && item.day === day);
  const reminders = dayItems.filter((item) => item.kind === "reminder").sort(compareTimeline);
  const triggers = dayItems.filter((item) => item.kind === "trigger").sort(byActiveFirst);
  const withTrigger = triggerAllowed(segment, day);
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

      {withTrigger && (
        <TriggerCard triggers={triggers} onCreate={() => onAddTrigger(day)} onEdit={onEdit} onToggle={onToggle} />
      )}

      <div className="flex flex-col gap-1">
        {withTrigger && <h2 className="m-0 text-[17px] font-semibold leading-snug text-siyoh">{copy.reminders}</h2>}
        <p className="m-0 text-sm text-qalam">{dayNote(segment, day)}</p>
      </div>

      {reminders.length === 0 ? (
        <p className="m-0 rounded-[16px] bg-white px-4 py-6 text-center text-sm text-qalam">{copy.emptyDay}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-chiziq rounded-[16px] bg-white p-0">
          {reminders.map((item, index) => {
            const sameMoment = (other: MessageTemplate | undefined) => other !== undefined && isSameMoment(other, item);
            return (
              <MessageCard
                key={item.id}
                item={item}
                videoMarks={videoMarks}
                onEdit={() => onEdit(item)}
                onToggle={(isActive) => onToggle(item, isActive)}
                onMoveUp={sameMoment(reminders[index - 1]) ? () => onMove(reminders, index, -1) : undefined}
                onMoveDown={sameMoment(reminders[index + 1]) ? () => onMove(reminders, index, 1) : undefined}
              />
            );
          })}
        </ul>
      )}

      <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAddReminder(day)}>
        {copy.addForDay.replace("{n}", String(day))}
      </Button>
    </section>
  );
}
