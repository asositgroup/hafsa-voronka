"use client";

import { useEffect, useState } from "react";
import {
  type FunnelSegment,
  funnelSegments,
  MESSAGE_DAILY_CEILING,
  MESSAGE_TOTAL_MAX,
  type MessageCaps,
  messageCapsSchema,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { SaveStatus } from "@/components/admin/ui/SaveStatus";
import { Section } from "@/components/admin/ui/Section";
import { fetchSettings, saveSettings } from "@/lib/admin/settings";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.settings;

type Phase = "idle" | "saving" | "saved" | "error";

type CapText = { daily: string; total: string };

type CapsText = Record<FunnelSegment, CapText>;

function toText(caps: MessageCaps): CapsText {
  const entry = (segment: FunnelSegment): CapText => ({
    daily: String(caps[segment].daily),
    total: caps[segment].total === null ? "" : String(caps[segment].total),
  });
  return { A: entry("A"), B: entry("B"), C: entry("C") };
}

function parseCaps(text: CapsText): MessageCaps | null {
  const entry = (segment: FunnelSegment) => ({
    daily: Number(text[segment].daily),
    total: text[segment].total.trim() === "" ? null : Number(text[segment].total),
  });
  const parsed = messageCapsSchema.safeParse({ A: entry("A"), B: entry("B"), C: entry("C") });
  return parsed.success ? parsed.data : null;
}

export function MessageCapsCard() {
  const [text, setText] = useState<CapsText | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSettings().then((result) => {
      if (!active) return;
      if (result.ok) setText(toText(result.settings.messageCaps));
      else setPhase("error");
    });
    return () => {
      active = false;
    };
  }, []);

  function change(segment: FunnelSegment, key: keyof CapText, value: string) {
    setText((current) => (current ? { ...current, [segment]: { ...current[segment], [key]: value } } : current));
    setInvalid(false);
    setPhase("idle");
  }

  const save = async () => {
    if (!text) return;
    const caps = parseCaps(text);
    setInvalid(caps === null);
    if (!caps) return;
    setPhase("saving");
    const result = await saveSettings({ messageCaps: caps });
    if (result.ok) setText(toText(result.settings.messageCaps));
    setPhase(result.ok ? "saved" : "error");
  };

  const disabled = text === null || phase === "saving";

  return (
    <Section title={copy.caps.title} description={copy.caps.description}>
      <div className="flex flex-col gap-4">
        {funnelSegments.map((segment) => (
          <fieldset key={segment} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-semibold text-siyoh">{adminUz.segments[segment].label}</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Field label={copy.caps.daily} suffix={copy.caps.suffix}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MESSAGE_DAILY_CEILING}
                    value={text?.[segment].daily ?? ""}
                    disabled={disabled}
                    onChange={(e) => change(segment, "daily", e.target.value)}
                  />
                )}
              </Field>
              <Field label={copy.caps.total} suffix={copy.caps.suffix}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MESSAGE_TOTAL_MAX}
                    placeholder={copy.caps.noLimit}
                    value={text?.[segment].total ?? ""}
                    disabled={disabled}
                    onChange={(e) => change(segment, "total", e.target.value)}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        ))}
      </div>

      <p className={`m-0 text-[13px] ${invalid ? "text-anor" : "text-qalam"}`} role={invalid ? "alert" : undefined}>
        {invalid ? copy.caps.invalid : copy.caps.hint}
      </p>
      {phase === "error" && <Notice tone="danger">{copy.error}</Notice>}

      <div className="flex items-center justify-end gap-3">
        <SaveStatus state={phase === "saved" ? "saved" : "idle"} />
        <Button disabled={text === null} loading={phase === "saving"} loadingLabel={copy.saving} onClick={() => void save()}>
          {copy.save}
        </Button>
      </div>
    </Section>
  );
}
