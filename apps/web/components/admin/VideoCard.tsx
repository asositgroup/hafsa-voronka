"use client";

import { useRef, useState } from "react";
import { type AdminVideoItem, formatMmSs } from "@funnel/shared";
import { VideoMarksEditor } from "@/components/admin/VideoMarksEditor";
import { uploadVideoFile } from "@/lib/admin/r2Upload";
import {
  type VideosResult,
  activateVideo,
  archiveVideo,
  deleteVideo,
  unarchiveVideo,
  updateVideo,
} from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.card;
const errors = adminUz.videos.errors;

type Busy = "activate" | "archive" | "delete" | "offer" | null;

type VideoCardProps = {
  item: AdminVideoItem;
  uploadsEnabled: boolean;
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
};

function failureMessage(result: Extract<VideosResult, { ok: false }>) {
  if (result.error === "video_in_use") return errors.video_in_use.replace("{count}", String(result.userCount ?? 0));
  return errors[result.error as keyof typeof errors] ?? errors.generic;
}

export function VideoCard({ item, uploadsEnabled, onItems }: VideoCardProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [offerPercent, setOfferPercent] = useState(0);
  const [marksOpen, setMarksOpen] = useState(false);
  const offerInput = useRef<HTMLInputElement>(null);

  const archived = item.archivedAt !== null;
  const needsPrice = item.priceSec === null;

  async function run(action: Exclude<Busy, "offer" | null>, request: () => Promise<VideosResult>) {
    setBusy(action);
    setError(null);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    onItems(result.items, result.uploadsEnabled);
  }

  function remove() {
    if (!window.confirm(copy.confirmDelete.replace("{title}", item.title))) return;
    void run("delete", () => deleteVideo(item.id));
  }

  async function uploadOffer(file: File) {
    setBusy("offer");
    setError(null);
    setOfferPercent(0);
    try {
      const fileUrl = await uploadVideoFile(file, "offer", {
        onProgress: (bytes) => setOfferPercent(Math.round((bytes / file.size) * 100)),
      });
      const result = await updateVideo(item.id, { shortOfferVideoUrl: fileUrl });
      if (!result.ok) {
        setError(failureMessage(result));
        return;
      }
      onItems(result.items, result.uploadsEnabled);
    } catch {
      setError(errors.generic);
    } finally {
      setBusy(null);
    }
  }

  const buttonClass =
    "min-h-11 rounded-[10px] border border-chegara/60 px-4 text-sm font-medium text-siyoh transition-colors hover:border-siyoh disabled:opacity-50";

  return (
    <article className="flex flex-col gap-3 rounded-[16px] bg-white p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-[15px] font-semibold text-siyoh">{item.title}</h3>
          <p className="m-0 mt-0.5 text-xs tabular-nums text-qalam">
            {formatMmSs(item.duration)} · {item.userCount} {copy.users}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {item.isActive && (
            <span className="rounded-full bg-zumrad/15 px-2.5 py-1 text-[11px] font-semibold text-zumrad">
              {copy.active}
            </span>
          )}
          {archived && (
            <span className="rounded-full bg-chiziq px-2.5 py-1 text-[11px] font-semibold text-qalam">
              {copy.archived}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-2 text-xs text-qalam">
        <span>{copy.offerVideo}</span>
        {item.shortOfferVideoUrl && (
          <video
            src={item.shortOfferVideoUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[200px] w-full rounded-[12px] bg-black"
          />
        )}
        {uploadsEnabled && (
          <>
            <input
              ref={offerInput}
              type="file"
              accept="video/mp4"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadOffer(file);
              }}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => offerInput.current?.click()}
              className={buttonClass}
            >
              {busy === "offer"
                ? `${copy.offerUploading} ${offerPercent}%`
                : item.shortOfferVideoUrl
                  ? copy.replaceOffer
                  : copy.addOffer}
            </button>
          </>
        )}
      </div>

      {needsPrice && !item.isActive && !archived && <p className="m-0 text-xs text-qalam">{copy.needsPrice}</p>}

      {error && (
        <p role="alert" className="m-0 text-xs text-anor">
          {error}
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-chiziq pt-3">
        <button type="button" onClick={() => setMarksOpen((open) => !open)} className={buttonClass}>
          {marksOpen ? copy.hideMarks : copy.marks}
        </button>
        {!item.isActive && !archived && (
          <button
            type="button"
            disabled={needsPrice || busy !== null}
            onClick={() => void run("activate", () => activateVideo(item.id))}
            className="min-h-11 rounded-[10px] bg-siyoh px-4 text-sm font-semibold text-varaq transition-opacity disabled:opacity-40"
          >
            {busy === "activate" ? copy.activating : copy.activate}
          </button>
        )}
        {!item.isActive && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("archive", () => (archived ? unarchiveVideo(item.id) : archiveVideo(item.id)))}
            className={buttonClass}
          >
            {archived ? copy.unarchive : copy.archive}
          </button>
        )}
        {!item.isActive && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={remove}
            className="ml-auto min-h-11 rounded-[10px] px-3 text-sm font-medium text-qalam transition-colors hover:text-anor disabled:opacity-50"
          >
            {busy === "delete" ? copy.deleting : copy.delete}
          </button>
        )}
      </footer>

      {marksOpen && <VideoMarksEditor item={item} onItems={onItems} />}
    </article>
  );
}
