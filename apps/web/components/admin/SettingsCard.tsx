"use client";

import { useEffect, useState } from "react";
import { LINK_TTL_HOURS_MAX, LINK_TTL_HOURS_MIN } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { SaveStatus } from "@/components/admin/ui/SaveStatus";
import { Section } from "@/components/admin/ui/Section";
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
    <Section title={copy.title}>
      <Field
        label={copy.linkTtlLabel}
        hint={`${copy.linkTtlRange} ${copy.linkTtlHint}`}
        error={invalid ? copy.invalid : null}
        suffix={copy.hoursSuffix}
        className="sm:max-w-sm"
      >
        {({ id, describedBy, invalid: isInvalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={isInvalid}
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
          />
        )}
      </Field>

      {phase === "error" && <Notice tone="danger">{copy.error}</Notice>}

      <div className="flex items-center justify-end gap-3">
        <SaveStatus state={phase === "saved" ? "saved" : "idle"} />
        <Button disabled={!loaded} loading={phase === "saving"} loadingLabel={copy.saving} onClick={() => void save()}>
          {copy.save}
        </Button>
      </div>
    </Section>
  );
}
