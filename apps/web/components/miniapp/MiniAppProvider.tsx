"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SessionResponse } from "@funnel/shared";
import { fetchSession } from "@/lib/api";
import { uz } from "@/lib/i18n/uz";
import { initTelegramWebApp, waitForTelegramWebApp } from "@/lib/telegram";

type MiniAppContextValue = {
  initData: string;
  session: SessionResponse;
  setSession: (session: SessionResponse) => void;
};

type LoadState =
  | { type: "loading" }
  | { type: "no_telegram" }
  | { type: "error"; initData: string }
  | { type: "ready"; initData: string; session: SessionResponse };

export const MiniAppContext = createContext<MiniAppContextValue | null>(null);

export function useMiniApp() {
  const value = useContext(MiniAppContext);
  if (!value) throw new Error("useMiniApp must be used inside MiniAppProvider");
  return value;
}

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadState>({ type: "loading" });

  const load = useCallback(async (initData: string) => {
    setState({ type: "loading" });
    try {
      const session = await fetchSession(initData);
      setState({ type: "ready", initData, session });
    } catch {
      setState({ type: "error", initData });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void waitForTelegramWebApp().then((tg) => {
      if (!active) return;
      if (!tg?.initData) {
        setState({ type: "no_telegram" });
        return;
      }
      initTelegramWebApp(tg);
      void load(tg.initData);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const setSession = useCallback((session: SessionResponse) => {
    setState((current) => (current.type === "ready" ? { ...current, session } : current));
  }, []);

  if (state.type === "loading") return <LoadingScreen />;
  if (state.type === "no_telegram") return <OpenInTelegramScreen />;
  if (state.type === "error") return <ErrorScreen onRetry={() => load(state.initData)} />;

  return (
    <MiniAppContext.Provider value={{ initData: state.initData, session: state.session, setSession }}>
      {children}
    </MiniAppContext.Provider>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-6 h-6 rotate-45 border-2 border-oltin animate-spin motion-reduce:animate-none" />
      <p className="mt-6 text-sm text-kumush">{uz.app.loading}</p>
    </div>
  );
}

export function OpenInTelegramScreen() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
  const botUrl = botUsername ? `https://t.me/${botUsername}` : "https://t.me";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">
          {uz.app.openInTelegramTitle}
        </h1>
        <p className="text-sm text-kumush m-0">
          {uz.app.openInTelegramDesc}
        </p>
        <div className="pt-2">
          <a
            href={botUrl}
            className="flex items-center justify-center w-full min-h-[54px] rounded-[14px] bg-oltin text-siyoh text-[17px] font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {uz.app.openInTelegramButton}
          </a>
        </div>
      </div>
    </div>
  );
}

export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-siyoh text-varaq">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-varaq m-0">
          {uz.app.errorTitle}
        </h1>
        <p className="text-sm text-kumush m-0">
          {uz.app.errorMessage}
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center justify-center w-full min-h-[54px] rounded-[14px] border border-chegara-tun bg-transparent text-varaq text-[17px] font-semibold transition hover:bg-siyoh-deep active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
          >
            {uz.app.retryButton}
          </button>
        </div>
      </div>
    </div>
  );
}
