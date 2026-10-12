"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, normalizeUzPhone } from "@funnel/shared";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession, registerUser } from "@/lib/api";
import { uz } from "@/lib/i18n/uz";
import { getTelegramUser, getTelegramWebApp, hapticSuccess } from "@/lib/telegram";

const CONTACT_POLL_INTERVAL_MS = 1000;
const CONTACT_POLL_ATTEMPTS = 10;

type FieldErrors = { name?: string; phone?: string; general?: string };

export function RegistrationScreen() {
  const router = useRouter();
  const { initData, session, setSession } = useMiniApp();

  const [name, setName] = useState(() => session.name || getTelegramUser()?.first_name || "");
  const [phoneMode, setPhoneMode] = useState<"contact" | "manual">("contact");
  const [manualPhone, setManualPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(session.phoneSet);
  const [isPollingContact, setIsPollingContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submitRef = useRef<() => void>(() => {});
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(pollTimerRef.current), []);

  const handleSubmit = async () => {
    if (isSubmitting || isPollingContact) return;

    const trimmedName = name.trim();
    const newErrors: FieldErrors = {};

    if (trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH) {
      newErrors.name = uz.register.errors.nameRequired;
    }

    let phoneToSend: string | undefined;
    if (!phoneVerified) {
      const normalized = normalizeUzPhone(`+998${manualPhone}`);
      if (normalized) {
        phoneToSend = normalized;
      } else {
        newErrors.phone = uz.register.errors.phoneRequired;
      }
    }

    if (newErrors.name || newErrors.phone) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    const mainButton = getTelegramWebApp()?.MainButton;
    mainButton?.showProgress();
    mainButton?.disable();

    const fail = (nextErrors: FieldErrors) => {
      setIsSubmitting(false);
      mainButton?.hideProgress();
      mainButton?.enable();
      setErrors(nextErrors);
    };

    try {
      const result = await registerUser(initData, { name: trimmedName, phone: phoneToSend });
      if (!result.ok) {
        const message = result.message ?? uz.register.errors.generic;
        fail(result.field ? { [result.field]: message } : { general: message });
        return;
      }

      const nextSession = await fetchSession(initData, { reason: "poll" });
      mainButton?.hideProgress();
      mainButton?.hide();
      hapticSuccess();
      setSession(nextSession);
    } catch {
      fail({ general: uz.register.errors.generic });
    }
  };

  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (session.registered) router.replace("/app/watch");
  }, [router, session.registered]);

  useEffect(() => {
    const mainButton = getTelegramWebApp()?.MainButton;
    if (!mainButton) return;

    const onMainButtonClick = () => submitRef.current();
    mainButton.setText(uz.register.submitButton);
    mainButton.show();
    mainButton.enable();
    mainButton.onClick(onMainButtonClick);

    return () => {
      mainButton.offClick(onMainButtonClick);
      mainButton.hide();
    };
  }, []);

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
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const polled = await fetchSession(initData, { reason: "poll" });
          if (polled.phoneSet) {
            clearInterval(pollTimerRef.current);
            setIsPollingContact(false);
            setPhoneVerified(true);
            return;
          }
        } catch {}

        if (attempts >= CONTACT_POLL_ATTEMPTS) {
          clearInterval(pollTimerRef.current);
          setIsPollingContact(false);
          setPhoneMode("manual");
        }
      }, CONTACT_POLL_INTERVAL_MS);
    });
  };

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
