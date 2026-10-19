"use client";

import { useEffect, useState } from "react";
import { LINK_TTL_HOURS_MAX, LINK_TTL_HOURS_MIN } from "@funnel/shared";
import { fetchSettings, saveSettings } from "@/lib/admin/settings";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.settings;

type Phase = "idle" | "saving" | "saved" | "error";

export function SettingsCard() {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSettings().then((result) => {
      if (!active) return;
      if (result.ok) setValue(String(result.settings.linkTtlHours));
      setLoaded(result.ok);
      if (!result.ok) setPhase("error");
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    const hours = Number(value);
    const valid = Number.isInteger(hours) && hours >= LINK_TTL_HOURS_MIN && hours <= LINK_TTL_HOURS_MAX;
    setInvalid(!valid);
    if (!valid) return;
    setPhase("saving");
    const result = await saveSettings({ linkTtlHours: hours });
    if (result.ok) setValue(String(result.settings.linkTtlHours));
    setPhase(result.ok ? "saved" : "error");
  };

  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-white p-5">
      <h2 className="m-0 text-[15px] font-semibold text-siyoh">{copy.title}</h2>

      <label className="flex flex-col gap-1.5 text-xs text-qalam">
        {copy.linkTtlLabel}
        <input
          type="number"
          inputMode="numeric"
          min={LINK_TTL_HOURS_MIN}
          max={LINK_TTL_HOURS_MAX}
          value={value}
          disabled={!loaded || phase === "saving"}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
            setPhase("idle");
          }}
          className="h-11 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15 disabled:opacity-60"
        />
      </label>

      <p className="m-0 text-xs text-qalam">{copy.linkTtlHint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!loaded || phase === "saving"}
          onClick={() => void save()}
          className="h-11 flex-1 rounded-[10px] bg-siyoh px-4 text-sm font-semibold text-varaq transition-opacity disabled:opacity-40 sm:flex-none"
        >
          {phase === "saving" ? copy.saving : copy.save}
        </button>
        {invalid && <span className="text-xs text-anor">{copy.invalid}</span>}
        {phase === "saved" && <span className="text-xs text-qalam">{copy.saved}</span>}
        {phase === "error" && <span className="text-xs text-anor">{copy.error}</span>}
      </div>
    </section>
  );
}
