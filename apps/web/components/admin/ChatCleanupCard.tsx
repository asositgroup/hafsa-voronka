"use client";

import { useEffect, useState } from "react";
import { CHAT_CLEANUP_HOURS_OPTIONS } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field } from "@/components/admin/ui/Field";
import { Notice } from "@/components/admin/ui/Notice";
import { SaveStatus } from "@/components/admin/ui/SaveStatus";
import { Section } from "@/components/admin/ui/Section";
import { Select } from "@/components/admin/ui/Select";
import { fetchSettings, saveSettings } from "@/lib/admin/settings";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.settings;

type Phase = "idle" | "saving" | "saved" | "error";

const options = CHAT_CLEANUP_HOURS_OPTIONS.map((hours) => ({
  value: String(hours),
  label: copy.chatCleanup.option(hours),
}));

export function ChatCleanupCard() {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    let active = true;
    void fetchSettings().then((result) => {
      if (!active) return;
      if (result.ok) setValue(String(result.settings.chatCleanupHours));
      setLoaded(result.ok);
      if (!result.ok) setPhase("error");
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setPhase("saving");
    const result = await saveSettings({ chatCleanupHours: Number(value) });
    if (result.ok) setValue(String(result.settings.chatCleanupHours));
    setPhase(result.ok ? "saved" : "error");
  };

  return (
    <Section title={copy.chatCleanup.title}>
      <Field
        label={copy.chatCleanup.label}
        hint={copy.chatCleanup.hint}
        className="sm:max-w-sm"
      >
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={value}
            options={options}
            disabled={!loaded || phase === "saving"}
            onValueChange={(next) => {
              setValue(next);
              setPhase("idle");
            }}
          />
        )}
      </Field>

      {phase === "error" && <Notice tone="danger">{copy.error}</Notice>}

      <div className="flex items-center justify-end gap-3">
        <SaveStatus state={phase === "saved" ? "saved" : "idle"} />
        <Button
          disabled={!loaded}
          loading={phase === "saving"}
          loadingLabel={copy.saving}
          onClick={() => void save()}
        >
          {copy.save}
        </Button>
      </div>
    </Section>
  );
}
