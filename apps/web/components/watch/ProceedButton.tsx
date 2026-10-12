"use client";

import { useCallback, useEffect } from "react";
import { miniAppBeacon } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp, setMainButtonTheme } from "@/lib/telegram";

type ProceedButtonProps = {
  visible: boolean;
  channelUrl: string;
  initData: string;
};

const CLOSE_AFTER_OPEN_MS = 150;

export function ProceedButton({
  visible,
  channelUrl,
  initData,
}: ProceedButtonProps) {
  const handleClick = useCallback(() => {
    miniAppBeacon("/app/event", initData, { type: "channel_click" });
    const tg = getTelegramWebApp();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(channelUrl);
      setTimeout(() => tg.close(), CLOSE_AFTER_OPEN_MS);
    } else {
      window.open(channelUrl, "_blank");
    }
  }, [channelUrl, initData]);

  useEffect(() => {
    if (!visible) return undefined;
    const tg = getTelegramWebApp();
    if (!tg?.MainButton) return undefined;

    setMainButtonTheme(tg);
    tg.MainButton.setText(watchUz.proceedButton);
    tg.MainButton.show();
    tg.MainButton.enable();
    tg.MainButton.onClick(handleClick);

    return () => {
      tg.MainButton.offClick(handleClick);
      tg.MainButton.hide();
    };
  }, [visible, handleClick]);

  if (!visible) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center min-h-[54px] rounded-[14px] bg-oltin text-siyoh font-semibold text-[17px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
      >
        <span>{watchUz.proceedButton}</span>
      </button>
    </div>
  );
}
