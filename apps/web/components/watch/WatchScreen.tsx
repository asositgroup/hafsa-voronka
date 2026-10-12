"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PLAYBACK_RATE, PLAYBACK_RATES, type ProgressEvent, type ProgressResponse } from "@funnel/shared";
import { miniAppBeacon, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp, hapticSuccess } from "@/lib/telegram";
import { attachVideoSource } from "@/lib/video/hls";
import { formatTime } from "@/lib/video/format";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { ProgressBar } from "./ProgressBar";
import { ProceedButton } from "./ProceedButton";
import { Toast } from "./Toast";

export function WatchScreen() {
  const { initData, session, setSession } = useMiniApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(session.config.duration || 0);
  const [maxReached, setMaxReached] = useState(session.progress.maxPosition || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [unlockAnchor, setUnlockAnchor] = useState({
    remainingSecs: session.progress.remainingSecs,
    position: session.progress.lastPosition,
  });

  const maxReachedRef = useRef(session.progress.maxPosition || 0);
  const hasSentStartRef = useRef(false);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(session.completed);
  const playbackRateRef = useRef(1);

  useEffect(() => {
    isCompletedRef.current = session.completed;
  }, [session.completed]);

  const isSeekLocked = session.config.seekLock && !session.completed;
  const isProceedVisible = !session.config.gateProceed || session.completed;

  const triggerToast = useCallback(() => {
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying]);

  const sendProgress = useCallback(
    async (position: number, event: ProgressEvent) => {
      try {
        const res = await miniAppPost("/app/progress", initData, {
          position,
          event,
        });
        if (res.ok) {
          const data = (await res.json()) as ProgressResponse;
          if (typeof data.maxPosition === "number") {
            const nextMax = Math.max(maxReachedRef.current, data.maxPosition);
            maxReachedRef.current = nextMax;
            setMaxReached(nextMax);
          }
          if (typeof data.remainingSecs === "number") {
            setUnlockAnchor({ remainingSecs: data.remainingSecs, position });
          }
          if (data.completed && !isCompletedRef.current) {
            hapticSuccess();
            setSession({ ...session, completed: true });
            getTelegramWebApp()?.disableClosingConfirmation?.();
          }
        }
      } catch {
        return;
      }
    },
    [initData, session, setSession],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cleanupHls: (() => void) | undefined;
    void attachVideoSource(video, session.config.videoUrl).then((cleanup) => {
      cleanupHls = cleanup;
    });

    return () => {
      cleanupHls?.();
    };
  }, [session.config.videoUrl]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const video = videoRef.current;
        if (video && !video.paused) {
          video.pause();
        }
        if (video) {
          miniAppBeacon("/app/progress", initData, {
            position: video.currentTime,
            event: "pause",
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initData]);

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      getTelegramWebApp()?.disableClosingConfirmation?.();
    };
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }

    const resumePos = session.progress.lastPosition;
    if (resumePos > 0 && resumePos < video.duration) {
      video.currentTime = resumePos;
      setCurrentTime(resumePos);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    setCurrentTime(current);

    if (isSeekLocked) {
      if (!video.seeking && current <= maxReachedRef.current + 2) {
        const nextMax = Math.max(maxReachedRef.current, current);
        maxReachedRef.current = nextMax;
        setMaxReached(nextMax);
      }
    } else {
      const nextMax = Math.max(maxReachedRef.current, current);
      maxReachedRef.current = nextMax;
      setMaxReached(nextMax);
    }
  };

  const handleSeeking = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isSeekLocked && video.currentTime > maxReachedRef.current + 1) {
      video.currentTime = maxReachedRef.current;
      triggerToast();
    }
  };

  const handleRateChange = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.playbackRate !== playbackRateRef.current) {
      video.playbackRate = playbackRateRef.current;
    }
  };

  const cycleSpeed = () => {
    const video = videoRef.current;
    if (!video) return;
    const index = PLAYBACK_RATES.indexOf(playbackRateRef.current as (typeof PLAYBACK_RATES)[number]);
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    playbackRateRef.current = next;
    video.playbackRate = next;
    setPlaybackRate(next);
    resetControlsTimeout();
  };

  const unlockRemainingSecs = Math.max(
    0,
    unlockAnchor.remainingSecs - Math.max(0, currentTime - unlockAnchor.position),
  );
  const showUnlockCountdown = !isProceedVisible && unlockRemainingSecs > 0;

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(true);
    setHasStarted(true);
    resetControlsTimeout();

    if (!hasSentStartRef.current) {
      hasSentStartRef.current = true;
      void miniAppPost("/app/event", initData, { type: "video_start" });
    }

    if (!session.completed) {
      getTelegramWebApp()?.enableClosingConfirmation?.();
    }

    void sendProgress(video.currentTime, "play");

    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    tickIntervalRef.current = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) {
        void sendProgress(v.currentTime, "tick");
      }
    }, 10000);
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(false);
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    getTelegramWebApp()?.disableClosingConfirmation?.();
    void sendProgress(video.currentTime, "pause");
  };

  const handleEnded = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(false);
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    getTelegramWebApp()?.disableClosingConfirmation?.();
    void sendProgress(video.currentTime, "ended");
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const tg = getTelegramWebApp();
    if (!isFullscreen) {
      tg?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      tg?.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleSeek = (targetTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[#09090B] px-4 py-6 text-white selection:bg-blue-500">
      <div className="flex w-full max-w-md flex-col space-y-6">
        <div
          ref={containerRef}
          onMouseMove={resetControlsTimeout}
          onTouchStart={resetControlsTimeout}
          className={
            isFullscreen
              ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090B]"
              : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-zinc-800"
          }
        >
          <Toast message={watchUz.seekLockedToast} visible={toastVisible} />

          <video
            ref={videoRef}
            playsInline
            preload="metadata"
            poster={session.config.poster}
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onRateChange={handleRateChange}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onClick={togglePlay}
            className="h-full w-full object-contain cursor-pointer"
          />

          {!hasStarted && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/90 text-white shadow-2xl shadow-blue-500/50 backdrop-blur-md transition-transform hover:scale-110 active:scale-95">
                <svg
                  className="ml-1 h-9 w-9 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          <div
            className={`absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 transition-opacity duration-300 ${
              controlsVisible || !isPlaying ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              maxReached={maxReached}
              seekLocked={isSeekLocked}
              onSeek={handleSeek}
              onSeekBlocked={triggerToast}
            />

            <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-zinc-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? watchUz.pause : watchUz.play}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white"
                >
                  {isPlaying ? (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? watchUz.unmute : watchUz.mute}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white"
                >
                  {isMuted ? (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09l2.09 2.09V4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                <span className="font-mono text-zinc-300">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={cycleSpeed}
                  aria-label={watchUz.speed}
                  className="flex h-8 min-w-11 items-center justify-center rounded-lg px-2 font-mono text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  {playbackRate}x
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? watchUz.exitFullscreen : watchUz.fullscreen}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white"
                >
                  {isFullscreen ? (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 px-1">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {watchUz.lessonTitle}
          </h1>
          <p className="text-sm text-zinc-400">
            {watchUz.lessonSubtitle}
          </p>
        </div>

        {showUnlockCountdown && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-center">
            <p className="text-sm font-medium text-zinc-200">
              {watchUz.unlockIn(formatTime(Math.ceil(unlockRemainingSecs / playbackRate)))}
            </p>
            {playbackRate < MAX_PLAYBACK_RATE && (
              <p className="mt-1 text-xs text-zinc-500">{watchUz.unlockHint}</p>
            )}
          </div>
        )}

        <div className="pt-2">
          <ProceedButton
            visible={isProceedVisible}
            channelUrl={session.config.channelUrl}
            initData={initData}
          />
        </div>
      </div>
    </div>
  );
}
