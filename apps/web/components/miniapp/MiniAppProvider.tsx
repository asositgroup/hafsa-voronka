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

const MiniAppContext = createContext<MiniAppContextValue | null>(null);

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
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      <p className="mt-4 text-sm text-zinc-400">{uz.app.loading}</p>
    </div>
  );
}

function OpenInTelegramScreen() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
  const botUrl = botUsername ? `https://t.me/${botUsername}` : "https://t.me";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-3xl">
          ✈️
        </div>
        <h1 className="text-xl font-bold text-white">{uz.app.openInTelegramTitle}</h1>
        <p className="text-sm text-zinc-400">{uz.app.openInTelegramDesc}</p>
        <a
          href={botUrl}
          className="inline-block w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          {uz.app.openInTelegramButton}
        </a>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-950/50 text-2xl text-rose-400">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-white">{uz.app.errorTitle}</h1>
        <p className="text-sm text-zinc-400">{uz.app.errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          {uz.app.retryButton}
        </button>
      </div>
    </div>
  );
}
