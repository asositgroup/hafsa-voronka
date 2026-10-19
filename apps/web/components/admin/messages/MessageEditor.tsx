"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  type FunnelSegment,
  type MessageTemplate,
  type MessageTemplateInput,
  TEMPLATE_MEDIA_MIME_TYPES,
  templateTextLimit,
  validateTemplateText,
  validateTiming,
  visibleLength,
  sanitizeTelegramHtml,
} from "@funnel/shared";
import { ButtonsEditor } from "@/components/admin/messages/ButtonsEditor";
import { MessagePreview } from "@/components/admin/messages/MessagePreview";
import { RichTextField } from "@/components/admin/messages/RichTextField";
import { defaultTiming, shiftTimingToDay, TimingPicker } from "@/components/admin/messages/TimingPicker";
import {
  createMessage,
  deleteMessage,
  messageMediaUrl,
  type MessagesResult,
  sendTestMessage,
  updateMessage,
  uploadMessageMedia,
} from "@/lib/admin/messages";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;
const errors = adminUz.messages.errors;
const acceptedMedia = Object.values(TEMPLATE_MEDIA_MIME_TYPES).flat().join(",");

function errorText(code: string | undefined, variable?: string) {
  const template = errors[code as keyof typeof errors] ?? errors.generic;
  return template.replace("{variable}", variable ?? "");
}

type Admin = { telegramId: number; label: string };

type MessageEditorProps = {
  segment: FunnelSegment;
  day: number;
  item: MessageTemplate | null;
  admins: Admin[];
  mediaEnabled: boolean;
  prefillSupported: boolean;
  onSaved: (item: MessageTemplate) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
};

export function MessageEditor({
  segment,
  day,
  item,
  admins,
  mediaEnabled,
  prefillSupported,
  onSaved,
  onDeleted,
  onClose,
}: MessageEditorProps) {
  const [draft, setDraft] = useState<MessageTemplateInput>(() =>
    item
      ? {
          segment: item.segment,
          day: item.day,
          text: item.text,
          media: item.media,
          timing: item.timing,
          buttons: item.buttons,
          isActive: item.isActive,
        }
      : {
          segment,
          day,
          text: "",
          media: null,
          timing: defaultTiming("after_entry", day),
          buttons: [],
          isActive: true,
        },
  );
  const [busy, setBusy] = useState<"save" | "upload" | "delete" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [testAdmin, setTestAdmin] = useState<number | null>(admins[0]?.telegramId ?? null);
  const [localMedia, setLocalMedia] = useState<{ url: string; type: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (localMedia) URL.revokeObjectURL(localMedia.url);
    };
  }, [localMedia]);

  const hasMedia = draft.media !== null;
  const sanitized = sanitizeTelegramHtml(draft.text);
  const textError = validateTemplateText(draft.text, hasMedia);
  const timingError = validateTiming(draft.day, draft.timing);
  const length = sanitized.ok ? visibleLength(sanitized.html) : draft.text.length;
  const limit = templateTextLimit(hasMedia);
  const valid = textError === null && timingError === null;
  const buttonsValid = draft.buttons.every((button) => button.text.trim() && (button.kind !== "link" || button.url.startsWith("https://")));

  function patch(values: Partial<MessageTemplateInput>) {
    setDraft((current) => ({ ...current, ...values }));
    setError(null);
  }

  async function run<T>(action: NonNullable<typeof busy>, request: () => Promise<MessagesResult<T>>, after: (data: T) => void) {
    setBusy(action);
    setError(null);
    setTestNote(null);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      setError(errorText(result.error, result.variable));
      return;
    }
    after(result.data);
  }

  const save = () =>
    run(
      "save",
      () => (item ? updateMessage(item.id, draft) : createMessage(draft)),
      (saved) => onSaved(saved),
    );

  const remove = () => run("delete", () => deleteMessage(item!.id), () => onDeleted(item!.id));

  const upload = (file: File) =>
    run(
      "upload",
      () => uploadMessageMedia(file),
      (media) => {
        setPreviewFailed(false);
        setLocalMedia({ url: URL.createObjectURL(file), type: media.type });
        patch({ media });
      },
    );

  const test = () =>
    run(
      "test",
      () => sendTestMessage(draft, testAdmin!, item?.id),
      () => setTestNote(copy.testSent),
    );

  function changeDay(next: number) {
    patch({ day: next, timing: shiftTimingToDay(draft.timing, draft.day, next) });
  }

  const previewSrc = localMedia?.url ?? (item?.media && draft.media?.fileId === item.media.fileId ? messageMediaUrl(item) : null);
  const mediaType = draft.media?.type;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <button type="button" aria-label={copy.close} onClick={onClose} className="absolute inset-0 bg-siyoh/40" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={item ? copy.editTitle : copy.newTitle}
        className="relative flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-[20px] bg-white p-5 pb-8 sm:max-h-none sm:w-[540px] sm:rounded-none"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold text-siyoh">{item ? copy.editTitle : copy.newTitle}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-[9px] px-3 text-[13px] font-medium text-qalam hover:text-siyoh">
            {copy.close}
          </button>
        </header>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-qalam">
            <span>{copy.day}</span>
            <select
              value={draft.day}
              onChange={(e) => changeDay(Number(e.target.value))}
              className="h-9 rounded-[10px] border border-chegara/60 bg-white px-2 text-sm text-siyoh"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {adminUz.messages.dayLabel.replace("{n}", String(n))}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <RichTextField value={draft.text} onChange={(text) => patch({ text })} invalid={textError !== null} />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span role="alert" className="text-anor">
              {draft.text && textError ? errorText(textError.error, textError.variable) : ""}
            </span>
            <span className={`tabular-nums ${length > limit ? "text-anor" : "text-qalam"}`}>
              {length} / {limit}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-qalam">{copy.preview}</h3>
          {draft.media && previewSrc && !previewFailed && (
            <div className="overflow-hidden rounded-[12px] bg-varaq">
              {mediaType === "photo" ? (
                <Image
                  src={previewSrc}
                  alt=""
                  width={800}
                  height={450}
                  unoptimized
                  className="max-h-[220px] w-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              ) : mediaType === "video" ? (
                <video src={previewSrc} controls preload="metadata" className="max-h-[220px] w-full bg-black" onError={() => setPreviewFailed(true)} />
              ) : (
                <audio src={previewSrc} controls preload="metadata" className="w-full" onError={() => setPreviewFailed(true)} />
              )}
            </div>
          )}
          {draft.media && (!previewSrc || previewFailed) && (
            <p className="m-0 text-xs text-qalam">{copy.mediaPreviewUnavailable}</p>
          )}
          <MessagePreview text={draft.text} buttons={draft.buttons} />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-qalam">{copy.media}</h3>
          {mediaEnabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={acceptedMedia}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
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
                  onClick={() => {
                    setLocalMedia(null);
                    patch({ media: null });
                  }}
                  className="h-9 rounded-[9px] px-3 text-[13px] font-medium text-qalam transition-colors hover:text-anor disabled:opacity-50"
                >
                  {copy.removeMedia}
                </button>
              )}
            </div>
          ) : (
            <p className="m-0 text-xs text-qalam">{copy.mediaDisabled}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-qalam">{copy.timingTitle}</h3>
          <TimingPicker day={draft.day} timing={draft.timing} onChange={(timing) => patch({ timing })} error={timingError} />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-qalam">{copy.buttonsTitle}</h3>
          <ButtonsEditor buttons={draft.buttons} onChange={(buttons) => patch({ buttons })} prefillSupported={prefillSupported} />
        </div>

        <label className="flex items-center gap-2 text-sm text-siyoh">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => patch({ isActive: e.target.checked })} className="h-4 w-4" />
          {copy.active}
        </label>

        <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
          <h3 className="m-0 text-[13px] font-semibold text-siyoh">{copy.testTitle}</h3>
          {admins.length === 0 ? (
            <p className="m-0 text-xs text-qalam">{copy.testNoAdmins}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={testAdmin ?? ""}
                onChange={(e) => setTestAdmin(Number(e.target.value))}
                className="h-9 min-w-0 flex-1 rounded-[10px] border border-chegara/60 bg-white px-2 text-sm text-siyoh"
              >
                {admins.map((admin) => (
                  <option key={admin.telegramId} value={admin.telegramId}>
                    {admin.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy !== null || !valid || !buttonsValid || testAdmin === null}
                onClick={() => void test()}
                className="h-9 rounded-[9px] border border-chegara/60 bg-white px-3 text-[13px] font-medium text-siyoh transition-colors hover:border-siyoh disabled:opacity-50"
              >
                {busy === "test" ? copy.testSending : copy.testSend}
              </button>
            </div>
          )}
          {testNote && <p className="m-0 text-xs text-zumrad">{testNote}</p>}
        </div>

        {error && (
          <p role="alert" className="m-0 text-xs text-anor">
            {error}
          </p>
        )}

        <footer className="flex flex-wrap items-center gap-2 border-t border-chiziq pt-4">
          {item &&
            (confirmDelete ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void remove()}
                className="h-10 rounded-[10px] bg-anor px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy === "delete" ? copy.deleting : copy.deleteConfirm}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-10 rounded-[10px] px-3 text-[13px] font-medium text-qalam transition-colors hover:text-anor"
              >
                {copy.delete}
              </button>
            ))}
          <button
            type="button"
            disabled={busy !== null || !valid || !buttonsValid}
            onClick={() => void save()}
            className="ml-auto h-10 rounded-[10px] bg-siyoh px-6 text-[13px] font-semibold text-varaq transition-opacity disabled:opacity-40"
          >
            {busy === "save" ? copy.saving : copy.save}
          </button>
        </footer>
      </section>
    </div>
  );
}
