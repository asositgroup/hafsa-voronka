"use client";

import { useState } from "react";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { hapticSuccess } from "@/lib/telegram";

type RenewState = "idle" | "opening" | "failed";

export function LinkExpiredScreen() {
  const { initData, session, setSession } = useMiniApp();
  const [renew, setRenew] = useState<RenewState>("idle");
  const offered = session.secondChance;

  const handleRenew = async () => {
    setRenew("opening");
    try {
      const res = await miniAppPost("/app/second-chance/accept", initData);
      if (!res.ok && res.status !== 409) throw new Error(`Renew failed: ${res.status}`);
      const next = await fetchSession(initData, { reason: "poll" });
      if (res.ok) hapticSuccess();
      setSession(next);
      setRenew("idle");
    } catch {
      setRenew("failed");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">{offered ? watchUz.secondChanceTitle : watchUz.expiredTitle}</h1>
        <p className="text-sm text-kumush m-0">{offered ? watchUz.secondChanceBody : watchUz.expiredBody}</p>
        {renew === "failed" && (
          <p role="status" className="text-sm text-oltin m-0">
            {watchUz.secondChanceFailed}
          </p>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handleRenew()}
            disabled={renew === "opening"}
            aria-busy={renew === "opening"}
            className="flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {renew === "opening"
              ? watchUz.secondChanceOpening
              : offered
                ? watchUz.secondChanceButton
                : watchUz.expiredButton}
          </button>
        </div>
      </div>
    </div>
  );
}
