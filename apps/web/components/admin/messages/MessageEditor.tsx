"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  attemptTargetSegments,
  type FunnelSegment,
  type MessageTemplate,
  type MessageTemplateInput,
  offerVariantOf,
  SECOND_CHANCE_SEGMENT,
  TEMPLATE_MEDIA_MIME_TYPES,
  templateTextLimit,
  validateTemplateText,
  dayForTiming,
  validateTiming,
  visibleLength,
  sanitizeTelegramHtml,
  statusTargetSegments,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/admin/ui/Dialog";
import { Field } from "@/components/admin/ui/Field";
import { Select } from "@/components/admin/ui/Select";
import { Disclosure } from "@/components/admin/ui/Disclosure";
import { Notice } from "@/components/admin/ui/Notice";
import { Segmented } from "@/components/admin/ui/Segmented";
import { Switch } from "@/components/admin/ui/Switch";
import { AttemptPicker, attemptsLabel } from "@/components/admin/messages/AttemptPicker";
import { ButtonsEditor } from "@/components/admin/messages/ButtonsEditor";
import { MessagePreview } from "@/components/admin/messages/MessagePreview";
import { StopPointPicker, stopPointLabel, type VideoMarks } from "@/components/admin/messages/StopPointPicker";
import { TextEditor } from "@/components/admin/messages/editor/TextEditor";
import { stageTiming, TimingPicker, timingSummary } from "@/components/admin/messages/TimingPicker";
import {
  createMessage,
  deleteMessage,
  messageMediaUrl,
  type MessagesResult,
  sendTestMessage,
  updateMessage,
  uploadMessageMedia,
} from "@/lib/admin/messages";
import { PhotoIcon, PlusIcon, VideoIcon, VoiceIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;
const errors = adminUz.messages.errors;
const mediaIcons = { photo: PhotoIcon, video: VideoIcon, voice: VoiceIcon };
const acceptedMedia = Object.values(TEMPLATE_MEDIA_MIME_TYPES).flat().join(",");
const extraErrorCodes = new Set([
  "statuses_invalid",
  "attempts_invalid",
  "button_not_allowed",
  "unsupported_type",
  "too_large",
  "media_not_configured",
  "media_chat_unavailable",
]);

function usesExtras(segment: FunnelSegment, draft: MessageTemplateInput) {
  return (
    draft.media !== null ||
    !draft.isActive ||
    draft.attempts !== null ||
    (statusTargetSegments.includes(segment) && draft.statuses !== null) ||
    (segment !== SECOND_CHANCE_SEGMENT && draft.buttons.length > 0)
  );
}

function extrasSummary(segment: FunnelSegment, draft: MessageTemplateInput, videoMarks: VideoMarks) {
  return [
    draft.media ? adminUz.messages.mediaBadge[draft.media.type] : null,
    draft.buttons.length > 0 ? adminUz.messages.buttonsCount.replace("{n}", String(draft.buttons.length)) : null,
    statusTargetSegments.includes(segment) && draft.statuses
      ? draft.statuses.map((status) => stopPointLabel(status, videoMarks)).join(", ")
      : null,
    draft.attempts ? attemptsLabel(draft.attempts) : null,
    draft.isActive ? null : adminUz.messages.inactive,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function errorText(code: string | undefined, variable?: string) {
  const template = errors[code as keyof typeof errors] ?? errors.generic;
  return template.replace("{variable}", variable ?? "");
}

type Admin = { telegramId: number; label: string };

export type MessagePreset = Pick<MessageTemplateInput, "text" | "timing"> &
  Partial<Pick<MessageTemplateInput, "day" | "statuses" | "buttons">>;

function sheetTitle(segment: FunnelSegment, draft: MessageTemplateInput, editing: boolean) {
  const variant = segment === SECOND_CHANCE_SEGMENT ? offerVariantOf(draft.statuses) : null;
  if (!variant) return editing ? copy.editTitle : copy.newTitle;
  return adminUz.messages.secondChance.editorTitle
    .replace("{n}", String(draft.day))
    .replace("{slot}", adminUz.messages.secondChance.slots[variant]);
}

type MessageEditorProps = {
  segment: FunnelSegment;
  item: MessageTemplate | null;
  preset?: MessagePreset;
  admins: Admin[];
  mediaEnabled: boolean;
  prefillSupported: boolean;
  videoMarks: VideoMarks;
  onSaved: (item: MessageTemplate) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
};

export function MessageEditor({
  segment,
  item,
  preset,
  admins,
  mediaEnabled,
  prefillSupported,
  videoMarks,
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
          statuses: item.statuses,
          attempts: item.attempts,
        }
      : {
          segment,
          day: preset?.day ?? 1,
          text: preset?.text ?? "",
          media: null,
          timing: preset?.timing ?? stageTiming(segment),
          buttons: preset?.buttons ?? [],
          isActive: true,
          statuses: preset?.statuses ?? null,
          attempts: null,
        },
  );
  const [busy, setBusy] = useState<"save" | "upload" | "delete" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [testAdmin, setTestAdmin] = useState<number | null>(admins[0]?.telegramId ?? null);
  const [localMedia, setLocalMedia] = useState<{ url: string; type: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [timingOpen, setTimingOpen] = useState(() => !item || window.matchMedia("(min-width: 1024px)").matches);
  const [extrasOpen, setExtrasOpen] = useState(() => usesExtras(segment, draft));
  const secondChance = segment === SECOND_CHANCE_SEGMENT;
  const [pickerOpen, setPickerOpen] = useState(false);
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
      if (result.error && extraErrorCodes.has(result.error)) setExtrasOpen(true);
      return;
    }
    after(result.data);
  }

  const payload: MessageTemplateInput = { ...draft, day: dayForTiming(draft.timing, draft.day) };

  const save = () =>
    run(
      "save",
      () => (item ? updateMessage(item.id, payload) : createMessage(payload)),
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

  const test = (adminTelegramId: number) =>
    run(
      "test",
      () => sendTestMessage(payload, adminTelegramId, item?.id),
      () => setTestNote(copy.testSent),
    );

  function startTest() {
    if (admins.length === 1) void test(admins[0].telegramId);
    else if (admins.length > 1) setPickerOpen(true);
  }

  const previewSrc = localMedia?.url ?? (item?.media && draft.media?.fileId === item.media.fileId ? messageMediaUrl(item) : null);
  const mediaType = draft.media?.type;

  const textMessage = draft.text && textError ? errorText(textError.error, textError.variable) : null;

  const canSubmit = valid && buttonsValid && busy === null;
  const MediaIcon = draft.media ? mediaIcons[draft.media.type] : null;

  const footer = (
    <div className="flex flex-col gap-3">
      {error && <Notice tone="danger">{error}</Notice>}
      {testNote && <Notice tone="success">{testNote}</Notice>}
      {admins.length === 0 && <p className="m-0 text-[13px] text-qalam">{copy.testNoAdmins}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!canSubmit || admins.length === 0}
            loading={busy === "test"}
            loadingLabel={copy.testSending}
            onClick={startTest}
          >
            {copy.testSend}
          </Button>
          <Button disabled={!canSubmit} loading={busy === "save"} loadingLabel={copy.saving} onClick={() => void save()}>
            {copy.save}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Sheet open onClose={onClose} title={sheetTitle(segment, draft, item !== null)} size="wide" footer={footer}>
        <div className="flex flex-col gap-4">
          <div className="lg:hidden">
            <Segmented
              label={copy.preview}
              role="tablist"
              fill
              value={tab}
              onChange={setTab}
              items={[
                { value: "edit", label: copy.tabEdit },
                { value: "preview", label: copy.tabPreview },
              ]}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-8">
            <div className={`${tab === "edit" ? "flex" : "hidden"} flex-col gap-5 lg:flex`}>
              <TextEditor
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

              {!secondChance && (
                <Disclosure
                  title={copy.timingTitle}
                  summary={timingSummary(draft.day, draft.timing, segment)}
                  open={timingOpen || timingError !== null}
                  onOpenChange={setTimingOpen}
                >
                  <TimingPicker
                    day={draft.day}
                    timing={draft.timing}
                    segment={segment}
                    onChange={patch}
                    error={timingError}
                  />
                </Disclosure>
              )}

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
              <Disclosure
                title={copy.extraTitle}
                summary={extrasSummary(segment, draft, videoMarks) || undefined}
                open={extrasOpen || !buttonsValid}
                onOpenChange={setExtrasOpen}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-chiziq px-3 py-1">
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold text-siyoh">
                      {MediaIcon && draft.media ? (
                        <>
                          <MediaIcon className="h-5 w-5 shrink-0 text-qalam" />
                          <span className="truncate">{adminUz.messages.mediaBadge[draft.media.type]}</span>
                        </>
                      ) : (
                        copy.media
                      )}
                    </span>
                    {!mediaEnabled ? (
                      <span className="text-[13px] text-qalam">{copy.mediaDisabled}</span>
                    ) : hasMedia ? (
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          loading={busy === "upload"}
                          loadingLabel={copy.uploading}
                          onClick={() => fileInput.current?.click()}
                        >
                          {copy.replaceMedia}
                        </Button>
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => {
                            setLocalMedia(null);
                            patch({ media: null });
                          }}
                        >
                          {copy.removeMedia}
                        </Button>
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        loading={busy === "upload"}
                        loadingLabel={copy.uploading}
                        icon={<PlusIcon className="h-4 w-4" />}
                        onClick={() => fileInput.current?.click()}
                      >
                        {copy.add}
                      </Button>
                    )}
                  </div>

                  <section aria-labelledby="extras-buttons" className="flex flex-col gap-2">
                    <h3 id="extras-buttons" className="m-0 text-sm font-medium text-siyoh">
                      {copy.buttonsTitle}
                    </h3>
                    <ButtonsEditor
                      segment={segment}
                      buttons={draft.buttons}
                      onChange={(buttons) => patch({ buttons })}
                      prefillSupported={prefillSupported}
                    />
                  </section>

                  {statusTargetSegments.includes(segment) && (
                    <StopPointPicker
                      segment={segment}
                      value={draft.statuses}
                      marks={videoMarks}
                      onChange={(statuses) => patch({ statuses })}
                    />
                  )}
                  {attemptTargetSegments.includes(segment) && (
                    <AttemptPicker value={draft.attempts} onChange={(attempts) => patch({ attempts })} />
                  )}

                  <Switch checked={draft.isActive} onChange={(isActive) => patch({ isActive })} label={copy.active} showLabel />
                </div>
              </Disclosure>

              {item && (
                <div>
                  <Button variant="dangerGhost" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                    {copy.delete}
                  </Button>
                </div>
              )}
            </div>

            <div className={`${tab === "preview" ? "flex" : "hidden"} flex-col gap-2 lg:sticky lg:top-0 lg:flex lg:self-start`}>
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
          </div>
        </div>
      </Sheet>

      <Dialog open={pickerOpen} title={copy.testPick} onClose={() => setPickerOpen(false)}>
        <Field label={copy.testAdmin} hideLabel>
          {({ id }) => (
            <Select
              id={id}
              value={testAdmin === null ? "" : String(testAdmin)}
              onValueChange={(next) => setTestAdmin(Number(next))}
              options={admins.map((admin) => ({ value: String(admin.telegramId), label: admin.label }))}
            />
          )}
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setPickerOpen(false)}>
            {adminUz.confirm.cancel}
          </Button>
          <Button
            disabled={testAdmin === null}
            onClick={() => {
              setPickerOpen(false);
              void test(testAdmin!);
            }}
          >
            {copy.testSend}
          </Button>
        </div>
      </Dialog>

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
