"use client";

import { useRef, useState } from "react";
import { type AdminVideoItem, VIDEO_MAX_BYTES } from "@funnel/shared";
import { AdminVideoPlayer } from "@/components/admin/AdminVideoPlayer";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog } from "@/components/admin/ui/Dialog";
import { ProgressBar } from "@/components/admin/ui/ProgressBar";
import { uploadVideoFile } from "@/lib/admin/r2Upload";
import { genericVideoError, videoFailureMessage } from "@/lib/admin/videoErrors";
import { readVideoDuration } from "@/lib/admin/videoDuration";
import { updateVideo } from "@/lib/admin/videos";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.offer;

type Phase = "idle" | "reading" | "uploading" | "saving" | "removing";

type ShortOfferVideoProps = {
  item: AdminVideoItem;
  uploadsEnabled: boolean;
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
  onError: (message: string | null) => void;
};

export function ShortOfferVideo({ item, uploadsEnabled, onItems, onError }: ShortOfferVideoProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = phase !== "idle";

  async function save(patch: Parameters<typeof updateVideo>[1]) {
    const result = await updateVideo(item.id, patch);
    if (!result.ok) {
      onError(videoFailureMessage(result));
      return;
    }
    onItems(result.items, result.uploadsEnabled);
  }

  async function upload(file: File) {
    onError(null);
    if (file.type !== "video/mp4") {
      onError(copy.onlyMp4);
      return;
    }
    if (file.size > VIDEO_MAX_BYTES) {
      onError(copy.tooLarge);
      return;
    }
    setPercent(0);
    try {
      setPhase("reading");
      const duration = await readVideoDuration(file).catch(() => null);
      if (duration === null) {
        onError(copy.noDuration);
        return;
      }
      setPhase("uploading");
      const fileUrl = await uploadVideoFile(file, "offer", {
        onProgress: (bytes) => setPercent(Math.round((bytes / file.size) * 100)),
      });
      setPhase("saving");
      await save({ shortOfferVideoUrl: fileUrl, shortOfferDuration: duration });
    } catch {
      onError(genericVideoError);
    } finally {
      setPhase("idle");
    }
  }

  async function remove() {
    setPhase("removing");
    onError(null);
    await save({ shortOfferVideoUrl: null });
    setPhase("idle");
    setConfirmOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
      <h4 className="m-0 text-sm font-semibold text-siyoh">{copy.title}</h4>
      <p className="m-0 text-[13px] leading-[1.45] text-qalam">{copy.hint}</p>

      {item.shortOfferVideoUrl ? (
        <AdminVideoPlayer src={item.shortOfferVideoUrl} maxHeight={220} />
      ) : (
        <p className="m-0 text-[13px] text-qalam">{copy.empty}</p>
      )}

      {phase === "reading" && <p className="m-0 text-[13px] text-qalam">{copy.reading}</p>}
      {phase === "uploading" && (
        <div className="flex flex-col gap-1.5">
          <ProgressBar value={percent} label={copy.uploading} />
          <p className="m-0 text-[13px] tabular-nums text-qalam">
            {copy.uploading}: {percent}%. {copy.keepOpen}
          </p>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="video/mp4"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {uploadsEnabled && (
          <Button variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
            {item.shortOfferVideoUrl ? copy.replace : copy.add}
          </Button>
        )}
        {item.shortOfferVideoUrl && (
          <Button
            variant="dangerGhost"
            disabled={busy}
            loading={phase === "removing"}
            loadingLabel={copy.removing}
            onClick={() => setConfirmOpen(true)}
          >
            {copy.remove}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={copy.confirmRemoveTitle}
        description={copy.confirmRemove}
        confirmLabel={copy.remove}
        busy={phase === "removing"}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
