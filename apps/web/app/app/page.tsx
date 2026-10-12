"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeUzPhone, type SessionResponse } from "@funnel/shared";
import { fetchSession, registerUser } from "@/lib/api";
import { uz } from "@/lib/i18n/uz";
import {
  getInitData,
  getTelegramUser,
  getTelegramWebApp,
  hapticSuccess,
  initTelegramWebApp,
} from "@/lib/telegram";

type ViewState =
  | { type: "checking" }
  | { type: "no_telegram" }
  | { type: "loading" }
  | { type: "error" }
  | { type: "register"; session: SessionResponse };

export default function AppPage() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>({ type: "checking" });
  const [initData, setInitData] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [phoneMode, setPhoneMode] = useState<"contact" | "manual">("contact");
  const [manualPhone, setManualPhone] = useState<string>("");
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [isPollingContact, setIsPollingContact] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    general?: string;
  }>({});

  const submitRef = useRef<() => void>(() => {});

  const loadSession = async (data: string) => {
    setViewState({ type: "loading" });
    try {
      const session = await fetchSession(data);
      if (session.registered) {
        router.replace("/app/watch");
        return;
      }
      const tgUser = getTelegramUser();
      const defaultName = session.name || tgUser?.first_name || "";
      setName(defaultName);
      if (session.phoneSet) {
        setPhoneVerified(true);
      }
      setViewState({ type: "register", session });
    } catch {
      setViewState({ type: "error" });
    }
  };

  useEffect(() => {
    let active = true;

    async function init() {
      await Promise.resolve();
      if (!active) return;

      initTelegramWebApp();
      const data = getInitData();
      setInitData(data);

      if (!data) {
        setViewState({ type: "no_telegram" });
        return;
      }

      setViewState({ type: "loading" });
      try {
        const session = await fetchSession(data);
        if (!active) return;
        if (session.registered) {
          router.replace("/app/watch");
          return;
        }
        const tgUser = getTelegramUser();
        const defaultName = session.name || tgUser?.first_name || "";
        setName(defaultName);
        if (session.phoneSet) {
          setPhoneVerified(true);
        }
        setViewState({ type: "register", session });
      } catch {
        if (active) {
          setViewState({ type: "error" });
        }
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async () => {
    if (isSubmitting || isPollingContact) return;

    const trimmedName = name.trim();
    const newErrors: { name?: string; phone?: string; general?: string } = {};

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      newErrors.name = uz.register.errors.nameRequired;
    }

    let phoneToSend: string | undefined;

    if (!phoneVerified) {
      const normalized = normalizeUzPhone(`+998${manualPhone}`);
      if (!normalized) {
        newErrors.phone = uz.register.errors.phoneRequired;
      } else {
        phoneToSend = normalized;
      }
    }

    if (newErrors.name || newErrors.phone) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const tg = getTelegramWebApp();
    tg?.MainButton?.showProgress();
    tg?.MainButton?.disable();

    try {
      const res = await registerUser(initData, {
        name: trimmedName,
        phone: phoneToSend,
      });

      if (!res.ok) {
        setIsSubmitting(false);
        tg?.MainButton?.hideProgress();
        tg?.MainButton?.enable();
        if (res.field === "name") {
          setErrors({ name: res.message });
        } else if (res.field === "phone") {
          setErrors({ phone: res.message });
        } else {
          setErrors({ general: res.message });
        }
        return;
      }

      tg?.MainButton?.hideProgress();
      tg?.MainButton?.hide();
      hapticSuccess();
      router.push("/app/watch");
    } catch {
      setIsSubmitting(false);
      tg?.MainButton?.hideProgress();
      tg?.MainButton?.enable();
      setErrors({ general: uz.register.errors.generic });
    }
  };

  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (viewState.type !== "register") return;

    const tg = getTelegramWebApp();
    if (!tg) return;

    const onMainButtonClick = () => {
      submitRef.current();
    };

    tg.MainButton.setText(uz.register.submitButton);
    tg.MainButton.show();
    tg.MainButton.enable();
    tg.MainButton.onClick(onMainButtonClick);

    return () => {
      tg.MainButton.offClick(onMainButtonClick);
      tg.MainButton.hide();
    };
  }, [viewState.type]);

  const handleRequestContact = () => {
    const tg = getTelegramWebApp();
    if (!tg || typeof tg.requestContact !== "function") {
      setPhoneMode("manual");
      return;
    }

    setErrors({});
    tg.requestContact((sent) => {
      if (!sent) {
        setPhoneMode("manual");
        return;
      }

      setIsPollingContact(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const s = await fetchSession(initData);
          if (s.phoneSet) {
            clearInterval(interval);
            setIsPollingContact(false);
            setPhoneVerified(true);
            return;
          }
        } catch {}

        if (attempts >= 10) {
          clearInterval(interval);
          setIsPollingContact(false);
          setPhoneMode("manual");
        }
      }, 1000);
    });
  };

  if (viewState.type === "checking" || viewState.type === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        <p className="mt-4 text-sm text-zinc-400">{uz.app.loading}</p>
      </div>
    );
  }

  if (viewState.type === "no_telegram") {
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
    const botUrl = botUsername ? `https://t.me/${botUsername}` : "https://t.me";
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-3xl">
            ✈️
          </div>
          <h1 className="text-xl font-bold text-white">
            {uz.app.openInTelegramTitle}
          </h1>
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

  if (viewState.type === "error") {
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
            onClick={() => loadSession(initData)}
            className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            {uz.app.retryButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between p-6">
      <div className="mx-auto w-full max-w-sm space-y-6 pt-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {uz.register.title}
          </h1>
          <p className="text-sm text-zinc-400">{uz.register.subtitle}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              {uz.register.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder={uz.register.namePlaceholder}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-white placeholder-zinc-500 outline-none transition focus:border-zinc-500"
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">
              {uz.register.phoneLabel}
            </label>

            {phoneVerified ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-3.5 py-2.5 text-sm font-medium text-emerald-400">
                <span>{uz.register.phoneVerifiedBadge}</span>
              </div>
            ) : phoneMode === "contact" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isPollingContact}
                  onClick={handleRequestContact}
                  className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-50"
                >
                  {isPollingContact
                    ? uz.register.waitingContact
                    : uz.register.shareContactButton}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setPhoneMode("manual")}
                    className="text-xs text-zinc-500 hover:text-zinc-400"
                  >
                    {uz.register.manualEntryHint}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 transition focus-within:border-zinc-500">
                  <span className="select-none font-medium text-zinc-400">
                    +998
                  </span>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setManualPhone(digits);
                      setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder={uz.register.phonePlaceholder}
                    className="ml-2 w-full bg-transparent text-white placeholder-zinc-500 outline-none"
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-rose-500">{errors.phone}</p>
                )}
              </div>
            )}
          </div>

          {errors.general && (
            <p className="text-center text-xs text-rose-500">{errors.general}</p>
          )}

          <noscript>
            <button
              type="submit"
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
            >
              {uz.register.submitButton}
            </button>
          </noscript>
        </form>
      </div>

      <div className="mx-auto w-full max-w-sm pb-4 pt-6">
        <p className="text-center text-xs text-zinc-500">
          {uz.register.privacyNote}
        </p>
      </div>
    </div>
  );
}
