"use client";

import { useEffect, useRef, useState } from "react";
import { type AdminVideoItem, VIDEO_MAX_BYTES } from "@funnel/shared";
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
    <section className="flex flex-col gap-3 rounded-[16px] bg-white p-5">
      <h2 className="m-0 text-[15px] font-semibold text-siyoh">{copy.title}</h2>

      <label className="flex flex-col gap-1.5 text-xs text-qalam">
        {copy.titleLabel}
        <input
          value={title}
          maxLength={120}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15 disabled:opacity-60"
        />
      </label>

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
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="h-11 rounded-[10px] border border-chegara/60 px-4 text-sm font-medium text-siyoh transition-colors hover:border-siyoh disabled:opacity-50"
        >
          {copy.pick}
        </button>
        <span className="min-w-0 truncate text-xs text-qalam">
          {file ? `${file.name} · ${Math.round(file.size / MB)} MB` : copy.fileLabel}
        </span>
      </div>

      <p className="m-0 text-xs text-qalam">{copy.faststartHint}</p>

      {phase === "reading" && <p className="m-0 text-xs text-qalam">{copy.readingDuration}</p>}
      {phase === "saving" && <p className="m-0 text-xs text-qalam">{copy.saving}</p>}

      {phase === "uploading" && file && (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-full bg-varaq"
          >
            <div className="h-full bg-zumrad transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="m-0 text-xs tabular-nums text-qalam">
            {copy.uploading}: {percent}% · {Math.round(uploaded / MB)} / {Math.round(file.size / MB)} MB
          </p>
          <p className="m-0 rounded-[10px] bg-oltin/20 px-3 py-2 text-xs font-medium text-siyoh">{copy.keepOpen}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-xs text-anor">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !file || !title.trim()}
          onClick={() => void submit()}
          className="h-11 flex-1 rounded-[10px] bg-siyoh px-4 text-sm font-semibold text-varaq transition-opacity disabled:opacity-40 sm:flex-none"
        >
          {copy.submit}
        </button>
        {phase === "uploading" && (
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            className="h-11 rounded-[10px] px-4 text-sm font-medium text-qalam transition-colors hover:text-anor"
          >
            {copy.cancel}
          </button>
        )}
      </div>
    </section>
  );
}
