"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type MessageTemplate, renderPlainText, SAMPLE_CONTEXT, variableValues } from "@funnel/shared";
import { Badge } from "@/components/admin/ui/Badge";
import { Switch } from "@/components/admin/ui/Switch";
import { timingLabel } from "@/components/admin/messages/TimingPicker";
import { GripIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages;
const sampleValues = variableValues(SAMPLE_CONTEXT);

function plainPreview(html: string) {
  const text = html.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return renderPlainText(text, sampleValues);
}

type MessageCardProps = {
  item: MessageTemplate;
  onEdit: () => void;
  onToggle: (isActive: boolean) => void;
};

export function MessageCard({ item, onEdit, onToggle }: MessageCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-[16px] bg-white p-2 sm:p-3 ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={copy.dragHandle}
        {...attributes}
        {...listeners}
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center self-start rounded-[10px] text-qalam hover:bg-varaq focus-visible:outline-2 focus-visible:outline-siyoh active:cursor-grabbing"
      >
        <GripIcon className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onEdit}
        aria-label={copy.edit}
        className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[10px] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-[13px] font-semibold ${item.isActive ? "text-siyoh" : "text-qalam"}`}>
            {copy.timing[item.timing.type].replace("{time}", timingLabel(item.timing))}
          </span>
          {!item.isActive && <Badge>{copy.inactive}</Badge>}
        </span>
        <span className={`line-clamp-2 text-sm ${item.isActive ? "text-siyoh" : "text-qalam"}`}>{plainPreview(item.text)}</span>
        {(item.media || item.buttons.length > 0) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {item.media && <Badge>{copy.mediaBadge[item.media.type]}</Badge>}
            {item.buttons.length > 0 && <Badge>{copy.buttonsCount.replace("{n}", String(item.buttons.length))}</Badge>}
          </span>
        )}
      </button>

      <Switch checked={item.isActive} onChange={onToggle} label={item.isActive ? copy.active : copy.inactive} />
    </article>
  );
}
