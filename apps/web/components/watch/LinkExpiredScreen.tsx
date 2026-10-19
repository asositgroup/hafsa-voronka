"use client";

import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { miniAppBeacon } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp } from "@/lib/telegram";

const CLOSE_AFTER_OPEN_MS = 150;

export function LinkExpiredScreen() {
  const { initData, session } = useMiniApp();
  const channelUrl = session.config.channelUrl;

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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">{watchUz.expiredTitle}</h1>
        <p className="text-sm text-kumush m-0">{watchUz.expiredBody}</p>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleClick}
            className="flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {watchUz.expiredButton}
          </button>
        </div>
      </div>
    </div>
  );
}
