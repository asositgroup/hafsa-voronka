"use client";

import { useCallback, useEffect } from "react";
import { miniAppBeacon } from "@/lib/api";
import { watchUz } from "@/lib/i18n/watch";
import { getTelegramWebApp } from "@/lib/telegram";

type ProceedButtonProps = {
  visible: boolean;
  channelUrl: string;
  initData: string;
};

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
    } else {
      window.open(channelUrl, "_blank");
    }
  }, [channelUrl, initData]);

  useEffect(() => {
    if (!visible) return undefined;
    const tg = getTelegramWebApp();
    if (!tg?.MainButton) return undefined;

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
    <div className="w-full transition-all duration-500">
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-[0.98]"
      >
        <span>{watchUz.proceedButton}</span>
      </button>
    </div>
  );
}
