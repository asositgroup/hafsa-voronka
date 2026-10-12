"use client";

import { useCallback, useEffect, useState } from "react";
import { LockIcon, SpinnerIcon } from "@/components/icons";
import { TelegramIcon } from "@/components/brand/TelegramIcon";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession } from "@/lib/api";
import { uz } from "@/lib/i18n/uz";
import { getTelegramWebApp } from "@/lib/telegram";

export function BotRegisterScreen() {
  const { initData, setSession } = useMiniApp();
  const [checking, setChecking] = useState(false);
  const [stillLocked, setStillLocked] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const next = await fetchSession(initData, { reason: "poll" });
      setStillLocked(!next.registered);
      setSession(next);
    } catch {
      setStillLocked(true);
    } finally {
      setChecking(false);
    }
  }, [initData, setSession]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [recheck]);

  const backToBot = () => {
    const tg = getTelegramWebApp();
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
    if (botUsername) tg?.openTelegramLink(`https://t.me/${botUsername}`);
    tg?.close();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-siyoh p-6 text-center text-varaq">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zumrad text-oltin">
          <LockIcon className="h-7 w-7" />
        </span>
        <h1 className="m-0 text-2xl font-bold tracking-tight">{uz.gate.title}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-kumush">{uz.gate.description}</p>

        <button
          type="button"
          onClick={backToBot}
          className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-oltin text-[17px] font-semibold text-siyoh transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-varaq"
        >
          <TelegramIcon className="h-[22px] w-[22px]" />
          {uz.gate.backToBot}
        </button>
        <button
          type="button"
          onClick={() => void recheck()}
          disabled={checking}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] text-kumush hover:text-varaq disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
        >
          {checking && <SpinnerIcon className="h-4 w-4" />}
          {uz.gate.recheck}
        </button>
        {stillLocked && !checking && (
          <p role="status" className="m-0 text-[14px] text-anor-tun">
            {uz.gate.stillLocked}
          </p>
        )}
      </div>
    </div>
  );
}
