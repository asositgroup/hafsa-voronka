"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { formatMmSs } from "@funnel/shared";
import { PlayIcon } from "@/components/icons";
import { attachVideoSource } from "@/lib/video/hls";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.videos.player;

export type VideoMarker = { sec: number; label: string };

type AdminVideoPlayerProps = {
  src: string;
  poster?: string;
  startAt?: number;
  markers?: VideoMarker[];
  lazy?: boolean;
  maxHeight?: number;
};

export const AdminVideoPlayer = forwardRef<HTMLVideoElement | null, AdminVideoPlayerProps>(function AdminVideoPlayer(
  { src, poster, startAt = 0, markers = [], lazy = true, maxHeight = 320 },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  const pending = useRef<{ sec: number; play: boolean } | null>(null);
  const [active, setActive] = useState(!lazy);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => video.current as HTMLVideoElement, []);

  const applyPending = useCallback(() => {
    const element = video.current;
    const request = pending.current;
    if (!element || !request) return;
    pending.current = null;
    if (request.sec > 0) element.currentTime = request.sec;
    if (request.play) void element.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!active || !element) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    setFailed(false);
    if (!pending.current && startAt > 0) pending.current = { sec: startAt, play: false };
    void attachVideoSource(element, src).then((cleanup) => {
      if (cancelled) cleanup?.();
      else detach = cleanup;
    });
    return () => {
      cancelled = true;
      detach?.();
      element.removeAttribute("src");
      element.load();
    };
  }, [active, src, startAt]);

  function start() {
    pending.current = { sec: startAt, play: true };
    setActive(true);
  }

  function seekTo(sec: number) {
    const element = video.current;
    if (!active || !element || element.readyState === 0) {
      pending.current = { sec, play: true };
      setActive(true);
      return;
    }
    element.currentTime = sec;
    void element.play().catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[12px] bg-black">
        <video
          ref={video}
          controls={active}
          playsInline
          preload={active ? "metadata" : "none"}
          poster={poster}
          onLoadedMetadata={applyPending}
          onError={() => active && setFailed(true)}
          className="block w-full bg-black"
          style={{ maxHeight, aspectRatio: active ? undefined : "16 / 9" }}
        />
        {!active && (
          <button
            type="button"
            aria-label={copy.play}
            onClick={start}
            className="absolute inset-0 flex items-center justify-center bg-siyoh/40 text-white transition-colors hover:bg-siyoh/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-siyoh">
              <PlayIcon className="h-6 w-6" />
            </span>
          </button>
        )}
      </div>
      {failed && <p className="m-0 text-[13px] text-anor">{copy.failed}</p>}
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {markers.map(({ sec, label }) => (
            <button
              key={`${label}-${sec}`}
              type="button"
              onClick={() => seekTo(sec)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-chegara/60 bg-white px-3 text-[13px] text-siyoh transition-colors hover:border-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
            >
              <span className="font-semibold tabular-nums">{formatMmSs(sec)}</span>
              <span className="text-qalam">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
