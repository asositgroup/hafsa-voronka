"use client";

import { useState } from "react";
import { type AdminVideoItem, formatMmSs } from "@funnel/shared";
import { ArchiveIcon, TrashIcon } from "@/components/icons";
import { AdminVideoPlayer, type VideoMarker } from "@/components/admin/AdminVideoPlayer";
import { ShortOfferVideo } from "@/components/admin/ShortOfferVideo";
import { VideoMarksEditor } from "@/components/admin/VideoMarksEditor";
import { VideoRolloutDialog } from "@/components/admin/VideoRolloutDialog";
import { VideoRolloutStatus } from "@/components/admin/VideoRolloutStatus";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog } from "@/components/admin/ui/Dialog";
import { Notice } from "@/components/admin/ui/Notice";
import { Card } from "@/components/admin/ui/Section";
import {
  type VideosResult,
  activateVideo,
  archiveVideo,
  deleteVideo,
  unarchiveVideo,
} from "@/lib/admin/videos";
import { useVideoRollouts } from "@/lib/admin/useVideoRollouts";
import { videoFailureMessage } from "@/lib/admin/videoErrors";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.card;

type Busy = "activate" | "archive" | "delete" | null;

type VideoCardProps = {
  item: AdminVideoItem;
  uploadsEnabled: boolean;
  onItems: (items: AdminVideoItem[], uploadsEnabled: boolean) => void;
};

function MarksTimeline({ item }: { item: AdminVideoItem }) {
  const marks = [
    { label: adminUz.videos.marks.introEnd, value: item.introEndSec },
    { label: adminUz.videos.marks.courseStart, value: item.courseStartSec },
    { label: adminUz.videos.marks.price, value: item.priceSec },
    { label: adminUz.videos.marks.unlock, value: item.unlockSec },
  ];

  return (
    <div role="img" aria-label={copy.timelineLabel} className="relative h-4">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-varaq" />
      {marks.map(({ label, value }) =>
        value === null || item.duration <= 0 ? null : (
          <span
            key={label}
            title={`${label}: ${formatMmSs(value)}`}
            className="absolute top-0 h-4 w-0.5 -translate-x-1/2 rounded-full bg-siyoh"
            style={{ left: `${Math.min(100, (value / item.duration) * 100)}%` }}
          />
        ),
      )}
    </div>
  );
}

export function VideoCard({ item, uploadsEnabled, onItems }: VideoCardProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [marksOpen, setMarksOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rolloutOpen, setRolloutOpen] = useState(false);
  const rollouts = useVideoRollouts(item.id, item.isActive);

  const archived = item.archivedAt !== null;
  const needsPrice = item.priceSec === null;
  const markers: VideoMarker[] = [
    { sec: item.introEndSec, label: adminUz.videos.marks.introEnd },
    { sec: item.courseStartSec, label: adminUz.videos.marks.courseStart },
    { sec: item.priceSec, label: adminUz.videos.marks.price },
    { sec: item.unlockSec, label: adminUz.videos.marks.unlock },
  ].filter((marker): marker is VideoMarker => marker.sec !== null);

  async function run(action: Exclude<Busy, null>, request: () => Promise<VideosResult>) {
    setBusy(action);
    setError(null);
    const result = await request();
    setBusy(null);
    setConfirmOpen(false);
    if (!result.ok) {
      setError(videoFailureMessage(result));
      return;
    }
    onItems(result.items, result.uploadsEnabled);
  }

  return (
    <Card>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-[15px] font-semibold text-siyoh">{item.title}</h3>
          <p className="m-0 mt-0.5 text-[13px] tabular-nums text-qalam">
            {formatMmSs(item.duration)}, {item.userCount} {copy.users}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {item.isActive && <Badge tone="success">{copy.active}</Badge>}
          {archived && <Badge>{copy.archived}</Badge>}
          {needsPrice && !archived && <Badge tone="attention">{copy.needsPriceBadge}</Badge>}
        </div>
      </header>

      <MarksTimeline item={item} />

      <AdminVideoPlayer src={item.fileUrl} markers={markers} />

      <ShortOfferVideo item={item} uploadsEnabled={uploadsEnabled} onItems={onItems} onError={setError} />

      {needsPrice && !item.isActive && !archived && <p className="m-0 text-[13px] text-qalam">{copy.needsPrice}</p>}

      {rollouts.latest && (
        <VideoRolloutStatus rollout={rollouts.latest} onCancel={rollouts.cancel} onError={setError} />
      )}

      {error && <Notice tone="danger" onDismiss={() => setError(null)}>{error}</Notice>}

      <footer className="flex flex-wrap items-center gap-2 border-t border-chiziq pt-3">
        <Button variant="secondary" onClick={() => setMarksOpen(true)}>
          {copy.marks}
        </Button>
        {!item.isActive && !archived && (
          <Button
            disabled={needsPrice || busy !== null}
            loading={busy === "activate"}
            loadingLabel={copy.activating}
            onClick={() => void run("activate", () => activateVideo(item.id))}
          >
            {copy.activate}
          </Button>
        )}
        {item.isActive && (
          <Button variant="secondary" disabled={busy !== null || rollouts.live} onClick={() => setRolloutOpen(true)}>
            {adminUz.videos.rollout.open}
          </Button>
        )}
        {!item.isActive && (
          <>
            <span className="ml-auto" />
            <Button
              variant="ghost"
              disabled={busy !== null}
              loading={busy === "archive"}
              icon={<ArchiveIcon className="h-4 w-4" />}
              onClick={() => void run("archive", () => (archived ? unarchiveVideo(item.id) : archiveVideo(item.id)))}
            >
              {archived ? copy.unarchive : copy.archive}
            </Button>
            <Button
              variant="dangerGhost"
              disabled={busy !== null}
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => setConfirmOpen(true)}
            >
              {copy.delete}
            </Button>
          </>
        )}
      </footer>

      {marksOpen && <VideoMarksEditor item={item} onItems={onItems} onClose={() => setMarksOpen(false)} />}

      {rolloutOpen && (
        <VideoRolloutDialog videoId={item.id} onCreated={rollouts.added} onClose={() => setRolloutOpen(false)} />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={copy.confirmDeleteTitle}
        description={copy.confirmDelete.replace("{title}", item.title)}
        confirmLabel={copy.delete}
        busy={busy === "delete"}
        onConfirm={() => void run("delete", () => deleteVideo(item.id))}
        onCancel={() => setConfirmOpen(false)}
      />

    </Card>
  );
}
