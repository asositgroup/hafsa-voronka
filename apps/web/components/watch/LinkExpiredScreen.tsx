"use client";

import { useState } from "react";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession, miniAppPost } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { hapticSuccess } from "@/lib/telegram";

type ReopenState = "idle" | "opening" | "closed" | "failed";

export function LinkExpiredScreen() {
  const { initData, setSession } = useMiniApp();
  const [reopen, setReopen] = useState<ReopenState>("idle");

  const handleReopen = async () => {
    setReopen("opening");
    try {
      const res = await miniAppPost("/app/reopen", initData);
      if (res.status === 409) {
        setReopen("closed");
        return;
      }
      if (!res.ok) throw new Error(`Reopen failed: ${res.status}`);
      const next = await fetchSession(initData, { reason: "poll" });
      hapticSuccess();
      setSession(next);
    } catch {
      setReopen("failed");
    }
  };

  const note = reopen === "closed" ? watchUz.reopenClosed : reopen === "failed" ? watchUz.reopenFailed : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">{watchUz.expiredTitle}</h1>
        <p className="text-sm text-kumush m-0">{watchUz.expiredBody}</p>
        {note && (
          <p role="status" className="text-sm text-oltin m-0">
            {note}
          </p>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void handleReopen()}
            disabled={reopen === "opening"}
            aria-busy={reopen === "opening"}
            className="flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {reopen === "opening" ? watchUz.reopenOpening : watchUz.reopenButton}
          </button>
        </div>
      </div>
    </div>
  );
}
