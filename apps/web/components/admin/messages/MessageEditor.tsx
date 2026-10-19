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
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog, Sheet } from "@/components/admin/ui/Dialog";
import { Field, Select } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { Switch } from "@/components/admin/ui/Switch";
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

  const remove = async () => {
    await run("delete", () => deleteMessage(item!.id), () => onDeleted(item!.id));
    setConfirmDelete(false);
  };

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

  const textMessage = draft.text && textError ? errorText(textError.error, textError.variable) : null;

  const footer = (
    <div className="flex flex-col gap-3">
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex items-center justify-between gap-3">
        {item ? (
          <Button variant="dangerGhost" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
            {copy.delete}
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={!valid || !buttonsValid || busy === "upload" || busy === "delete" || busy === "test"} loading={busy === "save"} loadingLabel={copy.saving} onClick={() => void save()}>
          {copy.save}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Sheet open onClose={onClose} title={item ? copy.editTitle : copy.newTitle} size="wide" footer={footer}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-8">
          <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-siyoh">{copy.status}</span>
              <Switch checked={draft.isActive} onChange={(isActive) => patch({ isActive })} label={copy.active} showLabel />
            </div>

            <RichTextField
              value={draft.text}
              onChange={(text) => patch({ text })}
              invalid={textError !== null}
              error={textMessage}
              counter={
                <span className={length > limit ? "text-anor" : ""}>
                  {length} / {limit}
                </span>
              }
            />

            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-semibold text-siyoh">{copy.media}</h3>
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
                    <Button
                      variant="dangerGhost"
                      disabled={busy !== null}
                      onClick={() => {
                        setLocalMedia(null);
                        patch({ media: null });
                      }}
                    >
                      {copy.removeMedia}
                    </Button>
                  )}
                </div>
              ) : (
                <Notice tone="info">{copy.mediaDisabled}</Notice>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold text-siyoh">{copy.buttonsTitle}</h3>
              <ButtonsEditor buttons={draft.buttons} onChange={(buttons) => patch({ buttons })} prefillSupported={prefillSupported} />
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold text-siyoh">{copy.timingTitle}</h3>
              <Field label={copy.day}>
                {({ id }) => (
                  <Select id={id} value={draft.day} onChange={(e) => changeDay(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {adminUz.messages.dayLabel.replace("{n}", String(n))}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <TimingPicker day={draft.day} timing={draft.timing} onChange={(timing) => patch({ timing })} error={timingError} />
            </div>
          </div>

          <details open className="group lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh">
              {copy.preview}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
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
              {draft.media && (!previewSrc || previewFailed) && <p className="m-0 text-[13px] text-qalam">{copy.mediaPreviewUnavailable}</p>}
              <MessagePreview text={draft.text} buttons={draft.buttons} />
            </div>
          </details>

          <div className="flex flex-col gap-3 rounded-[12px] bg-varaq p-3 lg:col-start-1">
            <h3 className="m-0 text-[15px] font-semibold text-siyoh">{copy.testTitle}</h3>
            {admins.length === 0 ? (
              <p className="m-0 text-[13px] text-qalam">{copy.testNoAdmins}</p>
            ) : (
              <Field
                label={copy.testAdmin}
                suffix={
                  <Button
                    variant="secondary"
                    disabled={busy !== null || !valid || !buttonsValid || testAdmin === null}
                    loading={busy === "test"}
                    loadingLabel={copy.testSending}
                    onClick={() => void test()}
                  >
                    {copy.testSend}
                  </Button>
                }
              >
                {({ id }) => (
                  <Select id={id} value={testAdmin ?? ""} onChange={(e) => setTestAdmin(Number(e.target.value))}>
                    {admins.map((admin) => (
                      <option key={admin.telegramId} value={admin.telegramId}>
                        {admin.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {testNote && <Notice tone="success">{testNote}</Notice>}
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={copy.deleteConfirmTitle}
        description={copy.deleteConfirm}
        confirmLabel={copy.delete}
        busy={busy === "delete"}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
