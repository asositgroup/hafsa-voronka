"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminVideoItem, DriveConfig } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { ProgressBar } from "@/components/admin/ui/ProgressBar";
import { Section } from "@/components/admin/ui/Section";
import {
  type DriveImportFailure,
  fetchDriveConfig,
  fetchDriveImport,
  startDriveImport,
} from "@/lib/admin/driveImport";
import { fetchVideos } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.drive;
const POLL_INTERVAL_MS = 2000;
const COPIED_RESET_MS = 2000;
const MB = 1024 * 1024;

type Progress = { bytesDone: number; totalBytes: number };

type VideoDriveImportFormProps = {
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
};

export function VideoDriveImportForm({ onItems }: VideoDriveImportFormProps) {
  const [config, setConfig] = useState<DriveConfig | null | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<DriveImportFailure | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const importing = starting || progress !== null;

  useEffect(() => {
    mounted.current = true;
    void fetchDriveConfig().then((result) => {
      if (mounted.current) setConfig(result);
    });
    return () => {
      mounted.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => {
      if (mounted.current) setCopied(false);
    }, COPIED_RESET_MS);
  }

  function poll(id: number) {
    pollTimer.current = setTimeout(async () => {
      const item = await fetchDriveImport(id);
      if (!mounted.current) return;
      if (!item || item.status === "running") {
        if (item) setProgress({ bytesDone: item.bytesDone, totalBytes: item.totalBytes });
        poll(id);
        return;
      }
      setProgress(null);
      if (item.status === "failed") {
        setError(item.error ?? "download_failed");
        return;
      }
      const result = await fetchVideos();
      if (mounted.current && result.ok) {
        setUrl("");
        setTitle("");
        onItems(result.items, result.uploadsEnabled);
      }
    }, POLL_INTERVAL_MS);
  }

  async function submit() {
    if (!url.trim()) return;
    setError(null);
    setStarting(true);
    const result = await startDriveImport({ url: url.trim(), title: title.trim() || undefined });
    if (!mounted.current) return;
    setStarting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProgress({ bytesDone: result.item.bytesDone, totalBytes: result.item.totalBytes });
    poll(result.item.id);
  }

  if (config === undefined) {
    return (
      <Section title={adminUz.videos.sources.drive}>
        <p className="m-0 text-[13px] text-qalam">{copy.loading}</p>
      </Section>
    );
  }

  if (!config?.enabled || !config.serviceAccountEmail) {
    return (
      <Section title={adminUz.videos.sources.drive}>
        <Notice tone="info">{copy.disabled}</Notice>
      </Section>
    );
  }

  const percent = progress && progress.totalBytes > 0 ? Math.min(99, Math.floor((progress.bytesDone / progress.totalBytes) * 100)) : 0;

  return (
    <Section title={adminUz.videos.sources.drive}>
      <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
        <h3 className="m-0 text-sm font-semibold text-siyoh">{copy.shareTitle}</h3>
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px] text-qalam">
          {copy.shareSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-siyoh">{copy.emailLabel}</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-[10px] border border-chegara/60 bg-white px-3 py-2 text-[13px] text-siyoh">
              {config.serviceAccountEmail}
            </code>
            <Button variant="secondary" onClick={() => void copyEmail(config.serviceAccountEmail!)}>
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
        </div>
      </div>

      <Field label={copy.linkLabel}>
        {({ id }) => (
          <Input
            id={id}
            type="url"
            inputMode="url"
            value={url}
            placeholder={copy.linkPlaceholder}
            disabled={importing}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
      </Field>

      <Field label={copy.titleLabel} hint={copy.titleHint}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={title}
            maxLength={120}
            disabled={importing}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </Field>

      {progress && (
        <div className="flex flex-col gap-2">
          <ProgressBar value={percent} label={copy.importing} />
          <p className="m-0 text-[13px] tabular-nums text-qalam">
            {copy.importing}: {percent}%, {Math.round(progress.bytesDone / MB)} / {Math.round(progress.totalBytes / MB)} MB
          </p>
          <Notice tone="info">{copy.keepOpenHint}</Notice>
        </div>
      )}

      {error && <Notice tone="danger">{copy.errors[error]}</Notice>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button disabled={!url.trim()} loading={importing} onClick={() => void submit()}>
          {copy.submit}
        </Button>
      </div>
    </Section>
  );
}
