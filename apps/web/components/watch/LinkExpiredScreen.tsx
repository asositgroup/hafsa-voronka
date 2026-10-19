"use client";

import { useState } from "react";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession, miniAppBeacon, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp, hapticSuccess } from "@/lib/telegram";

const CLOSE_AFTER_OPEN_MS = 150;

type AcceptState = "idle" | "opening" | "closed" | "failed";

export function LinkExpiredScreen() {
  const { initData, session, setSession } = useMiniApp();
  const channelUrl = session.config.channelUrl;
  const [accept, setAccept] = useState<AcceptState>("idle");
  const offered = session.secondChance && accept !== "closed";

  const handleClick = () => {
    miniAppBeacon("/app/event", initData, { type: "channel_click" });
    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(channelUrl);
      setTimeout(() => tg.close(), CLOSE_AFTER_OPEN_MS);
    } else {
      window.open(channelUrl, "_blank");
    }
  };

  const handleAgain = async () => {
    setAccept("opening");
    try {
      const res = await miniAppPost("/app/second-chance/accept", initData);
      if (res.status === 409) {
        setAccept("closed");
        return;
      }
      if (!res.ok) throw new Error(`Accept failed: ${res.status}`);
      const next = await fetchSession(initData, { reason: "poll" });
      hapticSuccess();
      setSession(next);
    } catch {
      setAccept("failed");
    }
  };

  const note = accept === "closed" ? watchUz.secondChanceClosed : accept === "failed" ? watchUz.secondChanceFailed : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">{offered ? watchUz.secondChanceTitle : watchUz.expiredTitle}</h1>
        <p className="text-sm text-kumush m-0">{offered ? watchUz.secondChanceBody : watchUz.expiredBody}</p>
        {note && (
          <p role="status" className="text-sm text-oltin m-0">
            {note}
          </p>
        )}
        <div className="pt-2 flex flex-col gap-3">
          {offered && (
            <button
              type="button"
              onClick={() => void handleAgain()}
              disabled={accept === "opening"}
              aria-busy={accept === "opening"}
              className="flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
            >
              {accept === "opening" ? watchUz.secondChanceOpening : watchUz.secondChanceButton}
            </button>
          )}
          <button
            type="button"
            onClick={handleClick}
            className={
              offered
                ? "flex w-full items-center justify-center min-h-[54px] rounded-[14px] border border-chegara-tun bg-transparent text-varaq font-semibold text-[17px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
                : "flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
            }
          >
            {watchUz.expiredButton}
          </button>
        </div>
      </div>
    </div>
  );
}
