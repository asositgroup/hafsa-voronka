"use client";

import { useState } from "react";
import type { VideoRollout } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { ConfirmDialog } from "@/components/admin/ui/Dialog";
import { formatCount, formatTashkentShort, rolloutFailureMessage } from "@/lib/admin/rollouts";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.rollout;

function statusText(rollout: VideoRollout): string | null {
  const total = rollout.targetCount ?? rollout.previewCount;
  const extras = (count: number, template: string) => (count > 0 ? [template.replace("{count}", formatCount(count))] : []);

  if (rollout.status === "scheduled") {
    return copy.status.scheduled
      .replace("{date}", formatTashkentShort(rollout.scheduledAt))
      .replace("{count}", formatCount(total));
  }
  if (rollout.status === "running") {
    return [
      copy.status.running.replace("{sent}", formatCount(rollout.sentCount)).replace("{target}", formatCount(total)),
      ...extras(rollout.blockedCount, copy.status.blocked),
    ].join(" · ");
  }
  if (rollout.status === "done") {
    return [
      copy.status.done.replace("{sent}", formatCount(rollout.sentCount)),
      ...extras(rollout.blockedCount, copy.status.blocked),
      ...extras(rollout.skippedCount, copy.status.skipped),
      ...extras(rollout.failedCount, copy.status.failed),
    ].join(" · ");
  }
  return null;
}

type VideoRolloutStatusProps = {
  rollout: VideoRollout;
  onCancel: (rolloutId: number) => Promise<string | null>;
  onError: (message: string) => void;
};

export function VideoRolloutStatus({ rollout, onCancel, onError }: VideoRolloutStatusProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const text = statusText(rollout);
  if (!text) return null;

  const live = rollout.status === "scheduled" || rollout.status === "running";

  async function confirm() {
    setBusy(true);
    const error = await onCancel(rollout.id);
    setBusy(false);
    setConfirmOpen(false);
    if (error) onError(rolloutFailureMessage(error));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[12px] bg-varaq px-3.5 py-2.5 text-sm text-siyoh">
      <p role="status" className="m-0 min-w-0 break-words tabular-nums">
        {text}
      </p>
      {live && (
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          {copy.cancel}
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={copy.confirmCancelTitle}
        description={rollout.status === "running" ? copy.confirmCancelRunning : copy.confirmCancelScheduled}
        confirmLabel={copy.cancel}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
