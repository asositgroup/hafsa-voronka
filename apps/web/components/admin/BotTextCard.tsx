"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  BOT_MEDIA_MIME_TYPES,
  type BotTextItem,
  botTextLimit,
  validateBotText,
} from "@funnel/shared";
import {
  type BotTextsResult,
  botMediaUrl,
  removeBotMedia,
  resetBotText,
  saveBotText,
  uploadBotMedia,
} from "@/lib/admin/botTexts";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog } from "@/components/admin/ui/Dialog";
import { Field, Input, Textarea } from "@/components/admin/ui/Field";
import { SaveStatus } from "@/components/admin/ui/SaveStatus";
import { Card } from "@/components/admin/ui/Section";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.botTexts;
const acceptedTypes = [...BOT_MEDIA_MIME_TYPES.photo, ...BOT_MEDIA_MIME_TYPES.video].join(",");

type Busy = "save" | "reset" | "upload" | "remove" | null;

function errorMessage(item: BotTextItem, code: string | undefined) {
  if (code === "unknown_placeholder" && item.placeholders.length === 0) return copy.errors.no_placeholders;
  return copy.errors[code as keyof typeof copy.errors] ?? copy.errors.generic;
}

type BotTextCardProps = {
  item: BotTextItem;
  mediaEnabled: boolean;
  onItems: (items: BotTextItem[]) => void;
};

export function BotTextCard({ item, mediaEnabled, onItems }: BotTextCardProps) {
  const current = item.text ?? item.defaultText;
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const isButton = item.kind === "button";
  const hasMedia = item.media !== null;
  const limit = botTextLimit(item.key, hasMedia);
  const length = draft.replace(/\{\w+\}/g, "").length;
  const validation = validateBotText(item.key, draft, hasMedia);
  const dirty = draft !== current;
  const edited = item.text !== null || hasMedia;
  const { label, when } = copy.items[item.key];

  async function run(action: Busy, request: () => Promise<BotTextsResult>, after?: (items: BotTextItem[]) => void) {
    setBusy(action);
    setError(null);
    setSaved(false);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(item, result.error));
      return;
    }
    onItems(result.items);
    after?.(result.items);
  }

  const save = () =>
    run("save", () => saveBotText(item.key, draft), () => setSaved(true));

  const reset = async () => {
    await run("reset", () => resetBotText(item.key), () => setDraft(item.defaultText));
    setResetOpen(false);
  };

  const upload = (file: File) => {
    setPreviewFailed(false);
    void run("upload", () => uploadBotMedia(item.key, file));
  };

  const fieldError = error ?? (dirty && validation ? errorMessage(item, validation ?? undefined) : null);
  const status = dirty ? "dirty" : saved ? "saved" : "idle";

  return (
    <Card>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-semibold text-siyoh">{label}</h3>
          <p className="m-0 mt-0.5 text-[13px] text-qalam">{when}</p>
        </div>
        {edited && <Badge tone="attention">{copy.edited}</Badge>}
      </header>

      {hasMedia && (
        <div className="relative overflow-hidden rounded-[12px] bg-varaq">
          {previewFailed ? (
            <p className="m-0 p-4 text-[13px] text-qalam">{copy.mediaPreviewUnavailable}</p>
          ) : item.media?.type === "photo" ? (
            <Image
              src={botMediaUrl(item)}
              alt=""
              width={800}
              height={450}
              unoptimized
              className="max-h-[240px] w-full object-contain"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <video
              src={botMediaUrl(item)}
              controls
              preload="metadata"
              className="max-h-[240px] w-full bg-black"
              onError={() => setPreviewFailed(true)}
            />
          )}
        </div>
      )}

      <Field
        label={label}
        hideLabel
        hint={item.placeholders.includes("name") ? copy.placeholderName : undefined}
        error={fieldError}
        counter={<span className={length > limit ? "text-anor" : ""}>{length} / {limit}</span>}
      >
        {({ id, describedBy, invalid }) =>
          isButton ? (
            <Input id={id} aria-describedby={describedBy} invalid={invalid || validation !== null} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid || validation !== null}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(8, Math.max(3, draft.split("\n").length + 1))}
            />
          )
        }
      </Field>

      {!isButton && mediaEnabled && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={acceptedTypes}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button
              variant="secondary"
              disabled={busy !== null}
              loading={busy === "upload"}
              loadingLabel={copy.uploading}
              onClick={() => fileInput.current?.click()}
            >
              {hasMedia ? copy.replaceMedia : copy.addMedia}
            </Button>
            {hasMedia && (
              <Button variant="dangerGhost" disabled={busy !== null} onClick={() => void run("remove", () => removeBotMedia(item.key))}>
                {copy.removeMedia}
              </Button>
            )}
          </div>
          <p className="m-0 text-[13px] text-qalam">{copy.mediaHint}</p>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-chiziq pt-3">
        {edited && (
          <Button variant="ghost" disabled={busy !== null} onClick={() => setResetOpen(true)}>
            {copy.reset}
          </Button>
        )}
        <SaveStatus state={status} />
        <Button
          disabled={!dirty || validation !== null}
          loading={busy === "save"}
          loadingLabel={copy.saving}
          onClick={save}
        >
          {copy.save}
        </Button>
      </footer>

      <ConfirmDialog
        open={resetOpen}
        title={copy.resetConfirmTitle}
        description={copy.resetConfirm}
        confirmLabel={copy.reset}
        busy={busy === "reset"}
        onConfirm={() => void reset()}
        onCancel={() => setResetOpen(false)}
      />
    </Card>
  );
}
