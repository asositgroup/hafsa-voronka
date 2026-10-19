"use client";

import { useRef, useState } from "react";
import { type AdminVideoItem, defaultLessonStartSec, formatMmSs, parseMmSs, validateVideoMarks } from "@funnel/shared";
import { AdminVideoPlayer } from "@/components/admin/AdminVideoPlayer";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/admin/ui/Button";
import { Sheet } from "@/components/admin/ui/Dialog";
import { Field, Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Notice } from "@/components/admin/ui/Notice";
import { SaveStatus } from "@/components/admin/ui/SaveStatus";
import { updateVideo } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.marks;
const errors = adminUz.videos.errors;

const fields = [
  { key: "introEndSec", label: copy.introEnd },
  { key: "courseStartSec", label: copy.courseStart },
  { key: "priceSec", label: copy.price },
  { key: "unlockSec", label: copy.unlock },
] as const;

type FieldKey = (typeof fields)[number]["key"];

const initialText = (value: number | null) => (value === null ? "" : formatMmSs(value));

type VideoMarksEditorProps = {
  item: AdminVideoItem;
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
  onClose: () => void;
};

export function VideoMarksEditor({ item, onItems, onClose }: VideoMarksEditorProps) {
  const player = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState<Record<FieldKey, string>>({
    introEndSec: initialText(item.introEndSec ?? defaultLessonStartSec(item, item.duration)),
    courseStartSec: initialText(item.courseStartSec),
    priceSec: initialText(item.priceSec),
    unlockSec: initialText(item.unlockSec),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: FieldKey, value: string) {
    setText((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function markHere(key: FieldKey) {
    const seconds = Math.floor(player.current?.currentTime ?? 0);
    setField(key, formatMmSs(seconds));
  }

  async function save() {
    const marks: Record<FieldKey, number | null> = { introEndSec: null, courseStartSec: null, priceSec: null, unlockSec: null };
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

  const footer = (
    <div className="flex flex-col gap-3">
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex items-center justify-end gap-3">
        <SaveStatus state={saved ? "saved" : "idle"} />
        <Button loading={busy} loadingLabel={copy.saving} onClick={() => void save()}>
          {copy.save}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={copy.sheetTitle.replace("{title}", item.title)} footer={footer}>
      <div className="flex flex-col gap-4">
        <AdminVideoPlayer ref={player} src={item.fileUrl} lazy={false} />

        <p className="m-0 text-sm text-qalam tabular-nums">
          {copy.totalDuration}: {formatMmSs(item.duration)}
        </p>

        <div className="flex flex-col gap-4">
          {fields.map(({ key, label }) => (
            <Field
              key={key}
              label={label}
              hint={key === "unlockSec" ? copy.unlockHint : key === "introEndSec" ? copy.introEndHint : undefined}
              suffix={
                <span className="flex items-center gap-1">
                  <Button variant="secondary" onClick={() => markHere(key)}>
                    {copy.setHere}
                  </Button>
                  <IconButton
                    label={`${copy.clear}: ${label}`}
                    icon={<CloseIcon className="h-4 w-4" />}
                    disabled={text[key] === ""}
                    onClick={() => setField(key, "")}
                  />
                </span>
              }
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={text[key]}
                  inputMode="numeric"
                  placeholder={copy.format}
                  className="tabular-nums"
                  onChange={(e) => setField(key, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
