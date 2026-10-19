"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type MessageTemplate, renderPlainText, SAMPLE_CONTEXT, variableValues } from "@funnel/shared";
import { timingLabel } from "@/components/admin/messages/TimingPicker";
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
      className={`flex items-stretch gap-2 rounded-[14px] bg-white p-3 ${isDragging ? "z-10 opacity-80 shadow-lg" : ""} ${
        item.isActive ? "" : "opacity-60"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={copy.dragHandle}
        {...attributes}
        {...listeners}
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-[8px] text-qalam hover:bg-varaq active:cursor-grabbing"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>

      <button type="button" onClick={onEdit} aria-label={copy.edit} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <p className="m-0 line-clamp-2 text-sm text-siyoh">{plainPreview(item.text)}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-varaq px-2 py-0.5 text-siyoh">
            {copy.timing[item.timing.type].replace("{time}", timingLabel(item.timing))}
          </span>
          {item.media && (
            <span className="rounded-full bg-oltin/20 px-2 py-0.5 text-siyoh">{copy.mediaBadge[item.media.type]}</span>
          )}
          {item.buttons.length > 0 && (
            <span className="rounded-full bg-varaq px-2 py-0.5 text-qalam">{item.buttons.length}</span>
          )}
        </div>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={item.isActive}
        aria-label={item.isActive ? copy.active : copy.inactive}
        onClick={() => onToggle(!item.isActive)}
        className={`relative h-6 w-11 shrink-0 self-center rounded-full transition-colors ${item.isActive ? "bg-zumrad" : "bg-chegara"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${item.isActive ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </article>
  );
}
