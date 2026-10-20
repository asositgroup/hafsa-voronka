"use client";

import { useEffect, useRef, useState } from "react";
import { type AdminVideoItem, VIDEO_MAX_BYTES } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { ProgressBar } from "@/components/admin/ui/ProgressBar";
import { Section } from "@/components/admin/ui/Section";
import { uploadVideoFile } from "@/lib/admin/r2Upload";
import { readVideoDuration } from "@/lib/admin/videoDuration";
import { createVideo } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.upload;
const MB = 1024 * 1024;

type Phase = "idle" | "reading" | "uploading" | "saving";

type VideoUploadFormProps = {
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
};

export function VideoUploadForm({ onItems }: VideoUploadFormProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  useEffect(() => {
    if (!busy) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);

  function pick(selected: File | undefined) {
    setError(null);
    if (!selected) return;
    if (selected.type !== "video/mp4") {
      setError(copy.onlyMp4);
      return;
    }
    if (selected.size > VIDEO_MAX_BYTES) {
      setError(copy.tooLarge);
      return;
    }
    setFile(selected);
    if (!title.trim()) setTitle(selected.name.replace(/\.mp4$/i, ""));
  }

  async function submit() {
    if (!file || !title.trim()) return;
    setError(null);
    setUploaded(0);
    const controller = new AbortController();
    abort.current = controller;

    try {
      setPhase("reading");
      const duration = await readVideoDuration(file).catch(() => null);
      if (duration === null) {
        setError(copy.noDuration);
        return;
      }

      setPhase("uploading");
      wakeLock.current = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
      const fileUrl = await uploadVideoFile(file, "main", {
        onProgress: setUploaded,
        signal: controller.signal,
      });

      setPhase("saving");
      const result = await createVideo({ title: title.trim(), fileUrl, duration });
      if (!result.ok) {
        setError(copy.failed);
        return;
      }
      onItems(result.items, result.uploadsEnabled);
      setTitle("");
      setFile(null);
    } catch {
      if (!controller.signal.aborted) setError(copy.failed);
    } finally {
      await wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
      abort.current = null;
      setPhase("idle");
    }
  }

  const percent = file ? Math.min(100, Math.round((uploaded / file.size) * 100)) : 0;

  return (
    <Section title={copy.title}>
      <Field label={copy.titleLabel}>
        {({ id }) => <Input id={id} value={title} maxLength={120} disabled={busy} onChange={(e) => setTitle(e.target.value)} />}
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-siyoh">{copy.fileLabel}</span>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
            {copy.pick}
          </Button>
          {file && (
            <span className="min-w-0 truncate text-[13px] text-qalam">
              {file.name}, {Math.round(file.size / MB)} MB
            </span>
          )}
        </div>
        <p className="m-0 text-[13px] text-qalam">{copy.faststartHint}</p>
      </div>

      {phase === "reading" && <p className="m-0 text-[13px] text-qalam">{copy.readingDuration}</p>}
      {phase === "saving" && <p className="m-0 text-[13px] text-qalam">{copy.saving}</p>}

      {phase === "uploading" && file && (
        <div className="flex flex-col gap-2">
          <ProgressBar value={percent} label={copy.uploading} />
          <p className="m-0 text-[13px] tabular-nums text-qalam">
            {copy.uploading}: {percent}%, {Math.round(uploaded / MB)} / {Math.round(file.size / MB)} MB
          </p>
          <Notice tone="attention">{copy.keepOpen}</Notice>
        </div>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {phase === "uploading" && (
          <Button variant="ghost" onClick={() => abort.current?.abort()}>
            {copy.cancel}
          </Button>
        )}
        <Button disabled={!file || !title.trim()} loading={busy} onClick={() => void submit()}>
          {copy.submit}
        </Button>
      </div>
    </Section>
  );
}
