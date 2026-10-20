"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OfferProgressResponse, ProgressEvent } from "@funnel/shared";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { miniAppBeacon, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { attachVideoSource } from "@/lib/video/hls";
import { shouldSendClosingBeat } from "@/lib/video/resume";
import { ProceedButton } from "./ProceedButton";

const TICK_MS = 5000;

type OfferFirstScreenProps = {
  url: string;
  onContinue: () => void;
};

export function OfferFirstScreen({ url, onContinue }: OfferFirstScreenProps) {
  const { initData, session } = useMiniApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastClosingBeatRef = useRef<number | null>(null);
  const [completed, setCompleted] = useState(false);

  const sendProgress = useCallback(
    async (position: number, event: ProgressEvent) => {
      try {
        const res = await miniAppPost("/app/offer-progress", initData, { position, event });
        if (!res.ok) return;
        const data = (await res.json()) as OfferProgressResponse;
        if (data.completed) setCompleted(true);
      } catch {
        return;
      }
    },
    [initData],
  );

  const stopTicking = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cleanupHls: (() => void) | undefined;
    void attachVideoSource(video, url).then((cleanup) => {
      cleanupHls = cleanup;
    });
    return () => cleanupHls?.();
  }, [url]);

  useEffect(() => {
    const sendClosingBeat = () => {
      const video = videoRef.current;
      if (!video || !shouldSendClosingBeat(lastClosingBeatRef.current, Date.now())) return;
      lastClosingBeatRef.current = Date.now();
      miniAppBeacon("/app/offer-progress", initData, { position: video.currentTime, event: "pause" });
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      videoRef.current?.pause();
      sendClosingBeat();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", sendClosingBeat);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", sendClosingBeat);
      stopTicking();
    };
  }, [initData, stopTicking]);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    void sendProgress(video.currentTime, "play");
    stopTicking();
    tickRef.current = setInterval(() => {
      const current = videoRef.current;
      if (current && !current.paused) void sendProgress(current.currentTime, "tick");
    }, TICK_MS);
  };

  const handlePause = () => {
    const video = videoRef.current;
    stopTicking();
    if (video && !video.ended) void sendProgress(video.currentTime, "pause");
  };

  const handleEnded = () => {
    const video = videoRef.current;
    stopTicking();
    if (video) void sendProgress(video.currentTime, "ended");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-siyoh text-varaq">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col pb-[max(28px,env(safe-area-inset-bottom))]">
        <div className="relative aspect-video w-full bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={session.config.poster}
            controlsList="nodownload"
            disablePictureInPicture
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-1.5 px-5 pt-5.5">
          <h1 className="m-0 text-[22px] leading-[1.25] font-bold text-varaq">{watchUz.offerTitle}</h1>
          <p className="m-0 text-[15px] text-kumush">{watchUz.offerSubtitle}</p>
        </div>

        <p role="status" className="m-0 px-5 pt-6 text-[15px] leading-[1.5] text-kumush">
          {completed ? watchUz.offerDoneNote : watchUz.offerWatchNote}
        </p>

        <div className="mt-auto flex flex-col gap-3 px-5 pt-6">
          <ProceedButton visible channelUrl={session.config.channelUrl} initData={initData} />
          <button
            type="button"
            onClick={onContinue}
            className="flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-chegara-tun bg-transparent text-[17px] font-semibold text-varaq transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {watchUz.offerFullLesson}
          </button>
        </div>
      </div>
    </div>
  );
}
