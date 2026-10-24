"use client";

import { useCallback, useEffect, useState } from "react";
import type { VideoRollout } from "@funnel/shared";
import { cancelRollout, fetchRollouts } from "@/lib/admin/videos";

const POLL_MS = 10_000;

export function isLiveRollout(rollout: VideoRollout | undefined): rollout is VideoRollout {
  return rollout !== undefined && (rollout.status === "scheduled" || rollout.status === "running");
}

export function useVideoRollouts(videoId: number, enabled: boolean) {
  const [rollouts, setRollouts] = useState<VideoRollout[]>([]);

  const refresh = useCallback(async () => {
    const result = await fetchRollouts(videoId);
    if (result.ok) setRollouts(result.data);
  }, [videoId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void fetchRollouts(videoId).then((result) => {
      if (active && result.ok) setRollouts(result.data);
    });
    return () => {
      active = false;
    };
  }, [videoId, enabled]);

  const latest = enabled ? rollouts[0] : undefined;
  const live = isLiveRollout(latest);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  const added = useCallback((rollout: VideoRollout) => {
    setRollouts((current) => [rollout, ...current.filter((item) => item.id !== rollout.id)]);
  }, []);

  const cancel = useCallback(
    async (rolloutId: number) => {
      const result = await cancelRollout(videoId, rolloutId);
      if (result.ok) added(result.data);
      else await refresh();
      return result.ok ? null : (result.error ?? "generic");
    },
    [videoId, added, refresh],
  );

  return { latest, live, added, cancel };
}
