"use client";

import { useRef, useState } from "react";
import { type AdminVideoItem, formatMmSs, parseMmSs, validateVideoMarks } from "@funnel/shared";
import { updateVideo } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.marks;
const errors = adminUz.videos.errors;

const fields = [
  { key: "introEndSec", label: copy.introEnd },
  { key: "courseStartSec", label: copy.courseStart },
  { key: "priceSec", label: copy.price },
] as const;

type FieldKey = (typeof fields)[number]["key"];

const initialText = (value: number | null) => (value === null ? "" : formatMmSs(value));

type VideoMarksEditorProps = {
  item: AdminVideoItem;
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
};

export function VideoMarksEditor({ item, onItems }: VideoMarksEditorProps) {
  const player = useRef<HTMLVideoElement>(null);
  const [selected, setSelected] = useState<FieldKey>("introEndSec");
  const [text, setText] = useState<Record<FieldKey, string>>({
    introEndSec: initialText(item.introEndSec),
    courseStartSec: initialText(item.courseStartSec),
    priceSec: initialText(item.priceSec),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: FieldKey, value: string) {
    setText((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function markHere() {
    const seconds = Math.floor(player.current?.currentTime ?? 0);
    setField(selected, formatMmSs(seconds));
  }

  async function save() {
    const marks: Record<FieldKey, number | null> = { introEndSec: null, courseStartSec: null, priceSec: null };
    for (const { key } of fields) {
      const raw = text[key].trim();
      if (raw === "") continue;
      const parsed = parseMmSs(raw);
      if (parsed === null) {
        setError(copy.invalidFormat);
        return;
      }
      marks[key] = parsed;
    }

    const invalid = validateVideoMarks(marks, item.duration, { requirePrice: item.isActive });
    if (invalid) {
      setError(errors[invalid]);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await updateVideo(item.id, marks);
    setBusy(false);
    if (!result.ok) {
      setError(errors[result.error as keyof typeof errors] ?? errors.generic);
      return;
    }
    onItems(result.items, result.uploadsEnabled);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-chiziq pt-3">
      <video
        ref={player}
        src={item.fileUrl}
        controls
        playsInline
        preload="metadata"
        className="max-h-[320px] w-full rounded-[12px] bg-black"
      />

      <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-[12px] bg-varaq p-1">
        {fields.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected === key}
            onClick={() => setSelected(key)}
            className={`min-h-11 rounded-[9px] px-2 text-xs font-semibold leading-tight transition-colors ${
              selected === key ? "bg-siyoh text-varaq" : "text-qalam"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={markHere}
        className="min-h-11 rounded-[10px] bg-oltin/30 px-4 text-sm font-semibold text-siyoh transition-colors hover:bg-oltin/50"
      >
        {copy.setHere}
      </button>

      <div className="flex flex-col gap-2">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-qalam">
              {label}
              <input
                value={text[key]}
                inputMode="numeric"
                placeholder={copy.format}
                onChange={(e) => setField(key, e.target.value)}
                onFocus={() => setSelected(key)}
                className="h-11 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm tabular-nums text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15"
              />
            </label>
            <button
              type="button"
              disabled={text[key] === ""}
              onClick={() => setField(key, "")}
              className="mt-5 min-h-11 shrink-0 rounded-[10px] px-3 text-[13px] font-medium text-qalam transition-colors hover:text-anor disabled:opacity-40"
            >
              {copy.clear}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="m-0 text-xs text-anor">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-zumrad">{copy.saved}</span>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="min-h-11 rounded-[10px] bg-siyoh px-5 text-sm font-semibold text-varaq transition-opacity disabled:opacity-40"
        >
          {busy ? copy.saving : copy.save}
        </button>
      </div>
    </div>
  );
}
