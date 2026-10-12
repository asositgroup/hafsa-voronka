"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, normalizeUzPhone } from "@funnel/shared";
import { CheckIcon, CloseIcon, PhoneIcon, SpinnerIcon, UserIcon } from "@/components/icons";
import { TelegramIcon } from "@/components/landing/TelegramIcon";
import { submitLead } from "@/lib/api";
import { leadFormUz } from "@/lib/i18n/landing";
import { getOrCreateVisitorId } from "@/lib/tracking/visitor";
import { readUtmParams, trackLead } from "@/lib/tracking/client";

const STORAGE_KEY = "lead_form";
const REDIRECT_DELAY_MS = 900;

type Status = "idle" | "submitting" | "success";
type FieldErrors = { name?: string; phone?: string; general?: string };

const LeadModalContext = createContext<(() => void) | null>(null);

export function useLeadModal() {
  return useContext(LeadModalContext);
}

export function botLink(visitorId: string) {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
  return visitorId ? `https://t.me/${botUsername}?start=v_${visitorId}` : `https://t.me/${botUsername}`;
}

function formatPhone(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)]
    .filter(Boolean)
    .join(" ");
}

function loadSaved(): { name: string; phone: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      name: typeof saved.name === "string" ? saved.name : "",
      phone: typeof saved.phone === "string" ? saved.phone.replace(/\D/g, "").slice(0, 9) : "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

function save(name: string, phone: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
  } catch {}
}

export function LeadModalProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ids = useId();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [redirectUrl, setRedirectUrl] = useState("");

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    const saved = loadSaved();
    setName((current) => current || saved.name);
    setPhone((current) => current || saved.phone);
    setStatus("idle");
    setErrors({});
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    nameRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      clearTimeout(redirectTimer.current);
      document.documentElement.style.overflow = "";
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "idle") return;

    const trimmedName = name.trim();
    const nextErrors: FieldErrors = {};
    if (trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH) {
      nextErrors.name = leadFormUz.errors.name;
    }
    if (!normalizeUzPhone(phone)) {
      nextErrors.phone = leadFormUz.errors.phone;
    }
    if (nextErrors.name || nextErrors.phone) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setStatus("submitting");
    const visitorId = getOrCreateVisitorId();
    const honeypot = new FormData(event.currentTarget).get("website");

    try {
      const result = await submitLead({
        visitor_id: visitorId,
        name: trimmedName,
        phone: `+998${phone}`,
        website: typeof honeypot === "string" && honeypot ? honeypot : undefined,
        page_url: window.location.href.slice(0, 500),
        ...readUtmParams(),
      });

      if (!result.ok) {
        setStatus("idle");
        const message = result.message ?? leadFormUz.errors.generic;
        setErrors(result.field ? { [result.field]: message } : { general: message });
        return;
      }

      save(trimmedName, phone);
      trackLead(result.eventId);
      const url = botLink(visitorId);
      setRedirectUrl(url);
      setStatus("success");
      redirectTimer.current = setTimeout(() => {
        window.location.href = url;
      }, REDIRECT_DELAY_MS);
    } catch {
      setStatus("idle");
      setErrors({ general: leadFormUz.errors.generic });
    }
  };

  const inputClass =
    "w-full min-h-[52px] rounded-[12px] border bg-white px-4 text-[17px] text-siyoh placeholder:text-chegara outline-none transition-colors focus:border-siyoh focus:ring-2 focus:ring-siyoh/20";

  return (
    <LeadModalContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-subtitle`}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed m-0 mt-auto h-fit max-h-[100dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] bg-varaq p-0 text-siyoh shadow-[0_-12px_40px_rgba(12,44,38,.25)] backdrop:bg-siyoh-deep/70 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-[440px] sm:rounded-[24px] sm:shadow-[0_24px_64px_rgba(12,44,38,.35)]"
      >
        <div className="relative px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 sm:pb-8">
          <button
            type="button"
            onClick={close}
            aria-label={leadFormUz.close}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-qalam transition-colors hover:bg-siyoh/8 hover:text-siyoh focus-visible:outline-2 focus-visible:outline-siyoh"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          {status === "success" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center" role="status">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zumrad text-varaq">
                <CheckIcon className="h-8 w-8" />
              </span>
              <h2 id={`${ids}-title`} className="m-0 text-[24px] font-bold leading-tight">
                {leadFormUz.successTitle(name.trim().split(" ")[0] ?? "")}
              </h2>
              <p id={`${ids}-subtitle`} className="m-0 text-[16px] leading-[1.5] text-qalam">
                {leadFormUz.successText}
              </p>
              <a
                href={redirectUrl}
                className="mt-2 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] bg-oltin px-7 text-[18px] font-semibold text-siyoh transition-colors hover:bg-[color-mix(in_oklab,var(--color-oltin)_90%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
              >
                <TelegramIcon className="h-[22px] w-[22px]" />
                {leadFormUz.openTelegram}
              </a>
            </div>
          ) : (
            <>
              <h2 id={`${ids}-title`} className="m-0 pr-10 text-[26px] font-bold leading-[1.15] tracking-[-0.01em]">
                {leadFormUz.title}
              </h2>
              <p id={`${ids}-subtitle`} className="m-0 mt-2 text-[16px] leading-[1.5] text-qalam">
                {leadFormUz.subtitle}
              </p>

              <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-name`} className="flex items-center gap-2 text-[14px] font-semibold text-qalam">
                    <UserIcon className="h-4 w-4" />
                    {leadFormUz.nameLabel}
                  </label>
                  <input
                    ref={nameRef}
                    id={`${ids}-name`}
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={NAME_MAX_LENGTH}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder={leadFormUz.namePlaceholder}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? `${ids}-name-error` : undefined}
                    className={`${inputClass} ${errors.name ? "border-anor" : "border-chegara"}`}
                  />
                  {errors.name && (
                    <p id={`${ids}-name-error`} className="m-0 text-[14px] text-anor">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-phone`} className="flex items-center gap-2 text-[14px] font-semibold text-qalam">
                    <PhoneIcon className="h-4 w-4" />
                    {leadFormUz.phoneLabel}
                  </label>
                  <div
                    className={`flex min-h-[52px] items-center rounded-[12px] border bg-white px-4 transition-colors focus-within:border-siyoh focus-within:ring-2 focus-within:ring-siyoh/20 ${
                      errors.phone ? "border-anor" : "border-chegara"
                    }`}
                  >
                    <span className="select-none text-[17px] font-medium text-qalam">+998</span>
                    <input
                      id={`${ids}-phone`}
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={formatPhone(phone)}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, "");
                        if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
                        setPhone(digits.slice(0, 9));
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      placeholder={leadFormUz.phonePlaceholder}
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? `${ids}-phone-error` : undefined}
                      className="ml-2 w-full bg-transparent text-[17px] tabular-nums text-siyoh placeholder:text-chegara outline-none"
                    />
                  </div>
                  {errors.phone && (
                    <p id={`${ids}-phone-error`} className="m-0 text-[14px] text-anor">
                      {errors.phone}
                    </p>
                  )}
                </div>

                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label>
                    Website
                    <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                  </label>
                </div>

                {errors.general && (
                  <p role="alert" className="m-0 text-center text-[14px] text-anor">
                    {errors.general}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="mt-2 inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] bg-oltin px-7 text-[18px] font-semibold text-siyoh transition-colors hover:bg-[color-mix(in_oklab,var(--color-oltin)_90%,black)] disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
                >
                  {status === "submitting" ? (
                    <>
                      <SpinnerIcon className="h-5 w-5" />
                      {leadFormUz.submitting}
                    </>
                  ) : (
                    <>
                      <TelegramIcon className="h-[22px] w-[22px]" />
                      {leadFormUz.submit}
                    </>
                  )}
                </button>

                <p className="m-0 text-center text-[13px] leading-[1.5] text-qalam">{leadFormUz.privacy}</p>
              </form>
            </>
          )}
        </div>
      </dialog>
    </LeadModalContext.Provider>
  );
}
