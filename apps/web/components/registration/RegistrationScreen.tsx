"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, normalizeUzPhone } from "@funnel/shared";
import { useMiniApp } from "@/components/miniapp/MiniAppProvider";
import { fetchSession, registerUser } from "@/lib/api";
import { uz } from "@/lib/i18n/uz";
import { getTelegramUser, getTelegramWebApp, hapticSuccess, setMainButtonTheme } from "@/lib/telegram";

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
    const tg = getTelegramWebApp();
    const mainButton = tg?.MainButton;
    if (!mainButton) return;

    setMainButtonTheme(tg);
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
    <div className="flex min-h-dvh flex-col justify-between p-6 bg-siyoh text-varaq">
      <div className="mx-auto w-full max-w-sm flex flex-col gap-6 pt-4">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-varaq m-0">
            {uz.register.title}
          </h1>
          <p className="text-sm text-kumush m-0">{uz.register.subtitle}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-kumush">
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
              className="w-full min-h-[44px] rounded-[10px] border border-chegara-tun bg-siyoh-deep px-3.5 py-2.5 text-varaq placeholder:text-kumush outline-none transition focus:border-oltin focus:ring-2 focus:ring-oltin text-[15px]"
            />
            {errors.name && (
              <p className="text-[14px] text-anor-tun m-0">{errors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-kumush">
              {uz.register.phoneLabel}
            </label>

            {phoneVerified ? (
              <div className="flex items-center gap-2 rounded-[10px] border border-zumrad bg-zumrad/30 px-3.5 py-2.5 text-sm font-medium text-varaq">
                <span className="w-2 h-2 rotate-45 bg-zumrad shrink-0 inline-block" />
                <span>{uz.register.phoneVerifiedBadge}</span>
              </div>
            ) : phoneMode === "contact" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isPollingContact}
                  onClick={handleRequestContact}
                  className="flex items-center justify-center gap-2.5 w-full min-h-[54px] rounded-[14px] bg-zumrad text-varaq text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oltin"
                >
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>
                    {isPollingContact
                      ? uz.register.waitingContact
                      : uz.register.shareContactButton}
                  </span>
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setPhoneMode("manual")}
                    className="text-xs text-kumush hover:underline p-1"
                  >
                    {uz.register.manualEntryHint}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center min-h-[44px] rounded-[10px] border border-chegara-tun bg-siyoh-deep px-3.5 py-2.5 transition focus-within:border-oltin focus-within:ring-2 focus-within:ring-oltin">
                  <span className="select-none font-medium text-kumush">
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
                    className="ml-2 w-full bg-transparent text-varaq placeholder:text-kumush outline-none text-[15px]"
                  />
                </div>
                {errors.phone && (
                  <p className="text-[14px] text-anor-tun m-0">{errors.phone}</p>
                )}
              </div>
            )}
          </div>

          {errors.general && (
            <p className="text-center text-[14px] text-anor-tun m-0">{errors.general}</p>
          )}

          <noscript>
            <button
              type="submit"
              className="w-full min-h-[54px] rounded-[14px] bg-oltin text-siyoh text-[17px] font-semibold"
            >
              {uz.register.submitButton}
            </button>
          </noscript>
        </form>
      </div>

      <div className="mx-auto w-full max-w-sm pb-4 pt-6">
        <p className="text-center text-sm text-kumush m-0">
          {uz.register.privacyNote}
        </p>
      </div>
    </div>
  );
}
