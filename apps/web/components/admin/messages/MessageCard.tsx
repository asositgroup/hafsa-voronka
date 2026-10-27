"use client";

import { type MessageTemplate, plainTextPreview, renderPlainText, SAMPLE_CONTEXT, variableValues } from "@funnel/shared";
import { Badge } from "@/components/admin/ui/Badge";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Switch } from "@/components/admin/ui/Switch";
import { stopPointLabel, type VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { timelineLabel } from "@/components/admin/messages/TimingPicker";
import { ButtonsIcon, ChevronDownIcon, ChevronUpIcon, PhotoIcon, VideoIcon, VoiceIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;
const sampleValues = variableValues(SAMPLE_CONTEXT);
const mediaIcons = { photo: PhotoIcon, video: VideoIcon, voice: VoiceIcon };

function MediaIcon({ type }: { type: keyof typeof mediaIcons }) {
  const Icon = mediaIcons[type];
  return <Icon className="h-4 w-4" />;
}

type MessageCardProps = {
  item: MessageTemplate;
  videoMarks: VideoMarks;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function MessageCard({ item, videoMarks, onEdit, onToggle, onMoveUp, onMoveDown }: MessageCardProps) {
  return (
    <li className="flex items-center gap-1 px-2 py-2 sm:px-3">
      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.edit}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-[10px] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
      >
        <span
          className={`w-[4.5rem] shrink-0 pt-px text-[13px] font-semibold tabular-nums text-siyoh sm:w-24 ${item.isActive ? "" : "opacity-60"}`}
        >
          {timelineLabel(item.day, item.minute)}
        </span>
        <span className={`flex min-w-0 flex-1 flex-col gap-1 ${item.isActive ? "" : "opacity-60"}`}>
          {item.statuses && (
            <span className="flex flex-wrap gap-1">
              {item.statuses?.map((status) => (
                <Badge key={status}>{stopPointLabel(status, videoMarks)}</Badge>
              ))}
            </span>
          )}
          <span className="line-clamp-2 text-sm text-siyoh">
            {renderPlainText(plainTextPreview(item.text, 140), sampleValues)}
          </span>
          {(item.media || item.buttons.length > 0) && (
            <span className="flex items-center gap-3 text-qalam">
              {item.media && (
                <span role="img" aria-label={copy.mediaBadge[item.media.type]} className="inline-flex">
                  <MediaIcon type={item.media.type} />
                </span>
              )}
              {item.buttons.length > 0 && (
                <span
                  role="img"
                  aria-label={copy.buttonsCount.replace("{n}", String(item.buttons.length))}
                  className="inline-flex min-w-0 items-center gap-1 text-xs"
                >
                  <ButtonsIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.buttons.map((button) => button.text).join(" · ")}</span>
                </span>
              )}
            </span>
          )}
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

      <Switch checked={item.isActive} onChange={onToggle} label={item.isActive ? copy.active : copy.inactive} />
    </li>
  );
}
