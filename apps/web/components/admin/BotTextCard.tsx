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

  const reset = () =>
    run("reset", () => resetBotText(item.key), () => setDraft(item.defaultText));

  const upload = (file: File) => {
    setPreviewFailed(false);
    void run("upload", () => uploadBotMedia(item.key, file));
  };

  return (
    <article className="flex flex-col gap-3 rounded-[16px] bg-white p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] font-semibold text-siyoh">{label}</h3>
          <p className="m-0 mt-0.5 text-xs text-qalam">{when}</p>
        </div>
        {edited && (
          <span className="shrink-0 rounded-full bg-oltin/20 px-2.5 py-1 text-[11px] font-semibold text-siyoh">
            {copy.edited}
          </span>
        )}
      </header>

      {hasMedia && (
        <div className="relative overflow-hidden rounded-[12px] bg-varaq">
          {previewFailed ? (
            <p className="m-0 p-4 text-xs text-qalam">{copy.mediaPreviewUnavailable}</p>
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

      {isButton ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={label}
          aria-invalid={validation !== null}
          className="h-11 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15"
        />
      ) : (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(8, Math.max(3, draft.split("\n").length + 1))}
          aria-label={label}
          aria-invalid={validation !== null}
          className="resize-y rounded-[10px] border border-chegara/60 bg-white px-3 py-2.5 text-sm leading-[1.5] text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15"
        />
      )}

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-qalam">{item.placeholders.includes("name") ? copy.placeholderName : ""}</span>
        <span className={`tabular-nums ${length > limit ? "text-anor" : "text-qalam"}`}>
          {length} / {limit}
        </span>
      </div>

      {(error || (dirty && validation)) && (
        <p role="alert" className="m-0 text-xs text-anor">
          {error ?? errorMessage(item, validation ?? undefined)}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-chiziq pt-3">
        {!isButton && mediaEnabled && (
          <>
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
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
              className="h-9 rounded-[9px] border border-chegara/60 px-3 text-[13px] font-medium text-siyoh transition-colors hover:border-siyoh disabled:opacity-50"
            >
              {busy === "upload" ? copy.uploading : hasMedia ? copy.replaceMedia : copy.addMedia}
            </button>
            {hasMedia && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("remove", () => removeBotMedia(item.key))}
                className="h-9 rounded-[9px] px-3 text-[13px] font-medium text-qalam transition-colors hover:text-anor disabled:opacity-50"
              >
                {copy.removeMedia}
              </button>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saved && !dirty && <span className="text-xs text-zumrad">{copy.saved}</span>}
          {edited && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={reset}
              className="h-9 rounded-[9px] px-3 text-[13px] font-medium text-qalam transition-colors hover:text-siyoh disabled:opacity-50"
            >
              {copy.reset}
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || validation !== null || busy !== null}
            onClick={save}
            className="h-9 rounded-[9px] bg-siyoh px-4 text-[13px] font-semibold text-varaq transition-opacity disabled:opacity-40"
          >
            {busy === "save" ? copy.saving : copy.save}
          </button>
        </div>
      </footer>

    </article>
  );
}
