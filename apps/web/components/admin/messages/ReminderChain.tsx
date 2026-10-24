"use client";

import {
  compareTimeline,
  EXPIRY_TIMELINE_GROUP,
  type FunnelSegment,
  linkBoundSegments,
  type MessageTemplate,
  plainTextPreview,
  renderPlainText,
  SAMPLE_CONTEXT,
  TEMPLATE_DAYS,
  timelineGroupKey,
  type TimelineGroupKey,
  timelineSortKey,
  variableValues,
} from "@funnel/shared";
import { MessageCard } from "@/components/admin/messages/MessageCard";
import type { MessagePreset } from "@/components/admin/messages/MessageEditor";
import { NightRules } from "@/components/admin/messages/NightRules";
import { ScheduleSimulator } from "@/components/admin/messages/ScheduleSimulator";
import { chainItems } from "@/components/admin/messages/StageOverview";
import { stopPointLabel, type VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { defaultTiming, stageTiming, timelineLabel } from "@/components/admin/messages/TimingPicker";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
import { EmptyState } from "@/components/admin/ui/States";
import { Switch } from "@/components/admin/ui/Switch";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;
const board = copy.board;
const sampleValues = variableValues(SAMPLE_CONTEXT);
const days = Array.from({ length: TEMPLATE_DAYS }, (_, index) => index + 1);

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

type CardActions = {
  videoMarks: VideoMarks;
  onEdit: (item: MessageTemplate) => void;
  onToggle: (item: MessageTemplate, isActive: boolean) => void;
  onMove: (group: MessageTemplate[], index: number, direction: -1 | 1) => void;
};

type BoardCardProps = Omit<CardActions, "onMove"> & {
  item: MessageTemplate;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function BoardCard({ item, videoMarks, onEdit, onToggle, onMoveUp, onMoveDown }: BoardCardProps) {
  return (
    <div className="flex items-start gap-1 rounded-[12px] bg-white p-1 shadow-sm ring-1 ring-chiziq hover:ring-siyoh/40">
      <button
        type="button"
        onClick={() => onEdit(item)}
        aria-label={copy.edit}
        className={`flex min-w-0 flex-1 flex-col gap-1 rounded-[10px] p-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${
          item.isActive ? "" : "opacity-50"
        }`}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-siyoh">{timelineLabel(item.timing)}</span>
          {item.statuses?.map((status) => (
            <Badge key={status}>{stopPointLabel(status, videoMarks)}</Badge>
          ))}
        </span>
        <span className="line-clamp-3 text-xs text-siyoh">
          {renderPlainText(plainTextPreview(item.text, 120), sampleValues)}
        </span>
      </button>
      {(onMoveUp || onMoveDown) && (
        <span className="flex shrink-0 flex-col">
          <IconButton
            size="sm"
            label={copy.moveUp}
            icon={<ChevronUpIcon className="h-4 w-4" />}
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className="!h-6"
          />
          <IconButton
            size="sm"
            label={copy.moveDown}
            icon={<ChevronDownIcon className="h-4 w-4" />}
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="!h-6"
          />
        </span>
      )}
      <Switch
        checked={item.isActive}
        onChange={(isActive) => onToggle(item, isActive)}
        label={item.isActive ? copy.active : copy.inactive}
      />
    </div>
  );
}

function CardStack({
  items,
  onMove,
  ...actions
}: CardActions & { items: MessageTemplate[] }) {
  const sameMoment = (item: MessageTemplate, other: MessageTemplate | undefined) =>
    other !== undefined && timelineSortKey(other) === timelineSortKey(item);
  return items.map((item, index) => (
    <BoardCard
        key={item.id}
        item={item}
        {...actions}
        onMoveUp={sameMoment(item, items[index - 1]) ? () => onMove(items, index, -1) : undefined}
        onMoveDown={sameMoment(item, items[index + 1]) ? () => onMove(items, index, 1) : undefined}
      />
  ));
}

function AddTile({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-h-11 items-center justify-center gap-1 rounded-[10px] border border-dashed border-chiziq text-xs font-medium text-qalam hover:border-siyoh/40 hover:text-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh ${className}`}
    >
      <PlusIcon className="h-3.5 w-3.5" />
      {board.add}
    </button>
  );
}


function WeekBoard({ segment, items, onAdd, ...actions }: CardActions & {
  segment: FunnelSegment;
  items: MessageTemplate[];
  onAdd: (preset?: MessagePreset) => void;
}) {
  const timeline = buildTimeline(items);
  const expiry = timeline.find((group) => group.key === EXPIRY_TIMELINE_GROUP);

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid min-w-[1050px] grid-cols-7 gap-2">
          {days.map((day) => {
            const list = timeline.find((group) => group.key === day)?.items ?? [];
            return (
              <section
                key={day}
                aria-labelledby={`day-${day}`}
                className="flex min-h-72 flex-col gap-2 rounded-[14px] bg-siyoh/[0.04] p-2"
              >
                <div className="flex items-center justify-between px-1">
                  <h2 id={`day-${day}`} className="m-0 text-sm font-semibold text-siyoh">
                    {copy.dayLabel.replace("{n}", String(day))}
                  </h2>
                  <span className={`text-xs tabular-nums ${list.length === 0 ? "text-qalam/50" : "text-qalam"}`}>
                    {list.length}
                  </span>
                </div>
                <CardStack items={list} {...actions} />
                <AddTile
                  label={board.addToDay.replace("{n}", String(day))}
                  className="mt-auto"
                  onClick={() => onAdd({ text: "", day, timing: defaultTiming(stageTiming(segment).type, day) })}
                />
              </section>
            );
          })}
        </div>
      </div>
      {expiry && (
        <section aria-labelledby="group-expiry" className="flex flex-col gap-2">
          <h2 id="group-expiry" className="m-0 px-1 text-sm font-semibold text-siyoh">
            {copy.expiryGroup}
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <CardStack items={expiry.items} {...actions} />
          </div>
        </section>
      )}
    </div>
  );
}

function LinkWindowList({ items, ...actions }: CardActions & { items: MessageTemplate[] }) {
  const { videoMarks, onEdit, onToggle, onMove } = actions;
  return buildTimeline(items).map((group) => (
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
  ));
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
  const actions = { videoMarks, onEdit, onToggle, onMove };

  if (!linkBoundSegments.includes(segment)) {
    return <WeekBoard segment={segment} items={chain} onAdd={onAdd} {...actions} />;
  }

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
      <NightRules notice={notice} onCreate={() => onAdd(nightNoticePreset)} onEdit={onEdit} onToggle={onToggle} />
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-qalam">{copy.count.replace("{n}", String(chain.length))}</p>
        <Button variant="secondary" icon={<PlusIcon className="h-4 w-4" />} onClick={() => onAdd()}>
          {copy.addMessage}
        </Button>
      </div>
      <LinkWindowList items={chain} {...actions} />
      {segment === "A" && <ScheduleSimulator segment={segment} items={items} />}
    </section>
  );
}
