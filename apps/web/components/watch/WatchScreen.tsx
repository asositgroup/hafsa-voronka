"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYBACK_RATES, type ProgressEvent, type ProgressResponse } from "@funnel/shared";
import { miniAppBeacon, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp, hapticSuccess, readStartMode } from "@/lib/telegram";
import { attachVideoSource } from "@/lib/video/hls";
import { formatTime } from "@/lib/video/format";
import {
  isSeekLocked as computeSeekLocked,
  mergeResume,
  resumeTarget,
  shouldSendClosingBeat,
  shouldShowResumeOverlay,
} from "@/lib/video/resume";
import {
  readCloudResume,
  readLocalResume,
  writeCloudResume,
  writeLocalResume,
} from "@/lib/video/resumeStore";
import { useResumeSeek } from "@/lib/video/useResumeSeek";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { HarakatWord } from "@/components/brand/HarakatWord";
import { ProgressBar } from "./ProgressBar";
import { ProceedButton } from "./ProceedButton";
import { ResumeOverlay } from "./ResumeOverlay";
import { Toast } from "./Toast";

export function WatchScreen() {
  const { initData, session, setSession } = useMiniApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(session.config.duration || 0);
  const [maxReached, setMaxReached] = useState(session.progress.maxPosition || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [startMode] = useState(() => readStartMode());
  const [resumeFrom, setResumeFrom] = useState(() =>
    mergeResume(
      {
        videoId: session.videoId,
        lastPosition: session.progress.lastPosition,
        maxPosition: session.progress.maxPosition,
      },
      readLocalResume(),
    ),
  );
  const [overlayOpen, setOverlayOpen] = useState(() =>
    shouldShowResumeOverlay({ startMode, resumeFrom, completed: session.completed }),
  );
  const [seekTarget, setSeekTarget] = useState(() => {
    if (startMode === "offer") return session.startAt;
    return shouldShowResumeOverlay({ startMode, resumeFrom, completed: session.completed })
      ? 0
      : resumeFrom;
  });
  const [unlockAnchor, setUnlockAnchor] = useState({
    remainingSecs: session.progress.remainingSecs,
    position: session.progress.lastPosition,
  });

  const initialResumeRef = useRef(resumeFrom);
  const playbackStartedRef = useRef(false);
  const lastClosingBeatRef = useRef<number | null>(null);
  const maxReachedRef = useRef(session.progress.maxPosition || 0);
  const hasSentStartRef = useRef(false);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(session.completed);
  const isUnlockedRef = useRef(session.unlocked);
  const playbackRateRef = useRef(1);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isCompletedRef.current = session.completed;
  }, [session.completed]);

  useEffect(() => {
    isUnlockedRef.current = session.unlocked;
  }, [session.unlocked]);

  const isSeekLocked = computeSeekLocked({
    seekLock: session.config.seekLock,
    completed: session.completed,
    priceSec: session.priceSec,
    maxReached,
  });
  const { markUserSeeked, isPositionPending } = useResumeSeek(videoRef, seekTarget);
  const reachedUnlockAt = session.unlockAt !== null && maxReached >= session.unlockAt;
  const isUnlocked = !session.config.gateProceed || session.unlocked || reachedUnlockAt;

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

  useEffect(() => {
    if (!speedMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!speedMenuRef.current?.contains(event.target as Node)) setSpeedMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [speedMenuOpen]);

  const sendProgress = useCallback(
    async (position: number, event: ProgressEvent) => {
      if (event !== "ended" && isPositionPending()) return;
      writeLocalResume(session.videoId, position);
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
          const completedNow = data.completed && !isCompletedRef.current;
          const unlockedNow = data.unlocked && !isUnlockedRef.current;
          if (completedNow || unlockedNow) {
            hapticSuccess();
            setSession({
              ...session,
              completed: session.completed || data.completed,
              unlocked: session.unlocked || data.unlocked,
            });
          }
          if (completedNow) {
            getTelegramWebApp()?.disableClosingConfirmation?.();
          }
        }
      } catch {
        return;
      }
    },
    [initData, isPositionPending, session, setSession],
  );

  useEffect(() => {
    if (!reachedUnlockAt || isUnlockedRef.current) return;
    const video = videoRef.current;
    if (video) void sendProgress(video.currentTime, "tick");
  }, [reachedUnlockAt, sendProgress]);

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
    const sendClosingBeat = () => {
      const video = videoRef.current;
      if (!video || isPositionPending()) return;
      if (!shouldSendClosingBeat(lastClosingBeatRef.current, Date.now())) return;
      lastClosingBeatRef.current = Date.now();
      writeLocalResume(session.videoId, video.currentTime);
      writeCloudResume(session.videoId, video.currentTime);
      miniAppBeacon("/app/progress", initData, {
        position: video.currentTime,
        event: "pause",
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const video = videoRef.current;
      if (video && !video.paused) {
        video.pause();
      }
      sendClosingBeat();
    };

    const tg = getTelegramWebApp();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", sendClosingBeat);
    tg?.onEvent?.("deactivated", sendClosingBeat);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", sendClosingBeat);
      tg?.offEvent?.("deactivated", sendClosingBeat);
    };
  }, [initData, isPositionPending, session.videoId]);

  useEffect(() => {
    let active = true;
    void readCloudResume().then((cloud) => {
      if (!active || playbackStartedRef.current || cloud === null) return;
      const merged = mergeResume(
        {
          videoId: session.videoId,
          lastPosition: session.progress.lastPosition,
          maxPosition: session.progress.maxPosition,
        },
        cloud,
      );
      if (merged <= initialResumeRef.current) return;
      initialResumeRef.current = merged;
      const showOverlay = shouldShowResumeOverlay({
        startMode,
        resumeFrom: merged,
        completed: session.completed,
      });
      setResumeFrom(merged);
      setOverlayOpen(showOverlay);
      if (startMode !== "offer") setSeekTarget(showOverlay ? 0 : merged);
    });
    return () => {
      active = false;
    };
  }, [session.videoId, session.progress.lastPosition, session.progress.maxPosition, session.completed, startMode]);

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

    const startPos = session.startAt;
    if (startMode === "offer" && startPos > maxReachedRef.current && startPos < video.duration) {
      maxReachedRef.current = startPos;
      setMaxReached(startPos);
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

  const setSpeed = (rate: (typeof PLAYBACK_RATES)[number]) => {
    const video = videoRef.current;
    if (!video) return;
    playbackRateRef.current = rate;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setSpeedMenuOpen(false);
    resetControlsTimeout();
  };

  const unlockRemainingSecs =
    session.unlockAt === null
      ? Math.max(0, unlockAnchor.remainingSecs - Math.max(0, currentTime - unlockAnchor.position))
      : Math.max(0, session.unlockAt - maxReached);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(true);
    resetControlsTimeout();

    playbackStartedRef.current = true;

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
    }, 5000);
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;

    setIsPlaying(false);
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    getTelegramWebApp()?.disableClosingConfirmation?.();
    writeCloudResume(session.videoId, video.currentTime);
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
    markUserSeeked();
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleResumeContinue = () => {
    const video = videoRef.current;
    if (!video) return;
    const target = resumeTarget(resumeFrom);
    setOverlayOpen(false);
    setSeekTarget(target);
    video.currentTime = target;
    setCurrentTime(target);
    void video.play().catch(() => {});
  };

  const handleResumeRestart = () => {
    const video = videoRef.current;
    if (!video) return;
    markUserSeeked();
    setOverlayOpen(false);
    setSeekTarget(0);
    video.currentTime = 0;
    setCurrentTime(0);
    void video.play().catch(() => {});
  };

  const targetGateSecs = duration > 0 ? duration * 0.7 : 1;
  const gateProgressPercent = isUnlocked
    ? Math.min(100, Math.max(70, duration > 0 ? (currentTime / duration) * 100 : 70))
    : Math.min(70, Math.max(0, (maxReached / targetGateSecs) * 70));

  const formattedRemainingTime = formatTime(
    Math.ceil(unlockRemainingSecs / playbackRate),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-siyoh text-varaq">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col pb-[max(28px,env(safe-area-inset-bottom))]">
        <div
          ref={containerRef}
          onMouseMove={resetControlsTimeout}
          onTouchStart={resetControlsTimeout}
          className={
            isFullscreen
              ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
              : "relative aspect-video w-full bg-black"
          }
        >
          <Toast message={watchUz.seekLockedToast} visible={toastVisible} />

          {overlayOpen && (
            <ResumeOverlay
              position={resumeFrom}
              onContinue={handleResumeContinue}
              onRestart={handleResumeRestart}
            />
          )}

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
            className="h-full w-full object-cover cursor-pointer"
          />

          <div
            className={`absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 px-3 pt-7 pb-2 bg-gradient-to-t from-black/78 to-transparent transition-opacity duration-300 ${
              controlsVisible || !isPlaying || speedMenuOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
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

            <div className="flex items-center justify-between text-varaq">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? watchUz.pause : watchUz.play}
                  className="flex h-11 w-11 items-center justify-center text-white"
                >
                  {isPlaying ? (
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <span className="text-[13px] text-varaq tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center">
                <div ref={speedMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSpeedMenuOpen((open) => !open)}
                    aria-label={`${watchUz.speed}: ${playbackRate}x`}
                    aria-haspopup="menu"
                    aria-expanded={speedMenuOpen}
                    className="flex h-11 min-w-11 items-center justify-center px-2 text-[14px] font-semibold text-white tabular-nums"
                  >
                    {playbackRate}x
                  </button>
                  {speedMenuOpen && (
                    <div
                      role="menu"
                      aria-label={watchUz.speed}
                      className="absolute right-0 bottom-full mb-1 flex min-w-[96px] flex-col overflow-hidden rounded-[12px] bg-siyoh-deep/95 py-1 shadow-[0_8px_24px_rgba(0,0,0,.4)] backdrop-blur"
                    >
                      {PLAYBACK_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          role="menuitemradio"
                          aria-checked={playbackRate === rate}
                          onClick={() => setSpeed(rate)}
                          className={`min-h-[40px] px-4 text-left text-[14px] font-semibold tabular-nums transition-colors ${
                            playbackRate === rate ? "text-oltin" : "text-varaq hover:bg-white/8"
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={
                    isFullscreen ? watchUz.exitFullscreen : watchUz.fullscreen
                  }
                  className="flex h-11 w-11 items-center justify-center text-white"
                >
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 px-5 pt-5.5">
          <h1 className="text-[22px] leading-[1.25] font-bold text-varaq m-0">
            {watchUz.lessonTitle}
          </h1>
          <p className="text-[15px] text-kumush m-0">{watchUz.lessonSubtitle}</p>
        </div>

        <div className="flex flex-col gap-3.5 px-5 pt-7">
          {!isUnlocked && (
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-varaq">
                {watchUz.channelUntil}
              </span>
              <span className="text-[15px] text-kumush tabular-nums">
                {watchUz.remaining(formattedRemainingTime)}
              </span>
            </div>
          )}

          <div className="relative h-2 rounded-[4px] bg-siyoh-deep">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-[4px] bg-oltin transition-all duration-300"
              style={{ width: `${gateProgressPercent}%` }}
            />
            <div
              className={`absolute left-[70%] top-1/2 w-3.5 h-3.5 -ml-[7px] -mt-[7px] rotate-45 transition-colors duration-300 ${
                isUnlocked
                  ? "bg-oltin ring-[3px] ring-siyoh"
                  : "bg-varaq"
              }`}
            />
          </div>

          {!isUnlocked ? (
            <p className="text-[14px] leading-[1.5] text-kumush m-0">
              {watchUz.gateNote}
            </p>
          ) : (
            <div className="flex flex-col gap-3.5 pt-2 transition-all duration-[320ms] ease-out motion-reduce:transition-none opacity-100">
              <div className="flex justify-end pt-2">
                <HarakatWord word="ahsantum" className="h-[96px]" />
              </div>
              <p className="text-[17px] leading-[1.5] text-varaq m-0">
                {watchUz.unlockedText}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto px-5 pt-6">
          {!isUnlocked ? (
            <button
              type="button"
              disabled
              className="w-full min-h-[54px] rounded-[14px] border-[1.5px] border-dashed border-chegara-tun bg-transparent text-kumush text-[17px] font-semibold flex items-center justify-center select-none"
            >
              {watchUz.lockedButton(formattedRemainingTime)}
            </button>
          ) : (
            <div className="transition-all duration-[320ms] ease-out motion-reduce:transition-none opacity-100">
              <ProceedButton
                visible={true}
                channelUrl={session.config.channelUrl}
                initData={initData}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
