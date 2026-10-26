"use client";

import {
  buttonPresets,
  MAX_TEMPLATE_BUTTONS,
  type TemplateButton,
  type TemplateButtonKind,
  templateButtonKinds,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Select } from "@/components/admin/ui/Select";
import { IconButton } from "@/components/admin/ui/IconButton";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const kindOptions = templateButtonKinds.map((kind) => ({ value: kind, label: copy.buttonKinds[kind] }));

function presetText(kind: TemplateButtonKind) {
  return kind in buttonPresets ? buttonPresets[kind as keyof typeof buttonPresets] : "";
}

const presetTexts = new Set<string>(Object.values(buttonPresets));

function convert(button: TemplateButton, kind: TemplateButtonKind): TemplateButton {
  const preset = presetText(kind);
  const text = preset || (presetTexts.has(button.text) ? "" : button.text);
  if (kind === "link") return { kind, text, url: "" };
  if (kind === "admin") return { kind, text, prefill: "" };
  return { kind, text };
}

type ButtonsEditorProps = {
  buttons: TemplateButton[];
  onChange: (buttons: TemplateButton[]) => void;
  prefillSupported: boolean;
};

export function ButtonsEditor({ buttons, onChange, prefillSupported }: ButtonsEditorProps) {
  const update = (index: number, button: TemplateButton) =>
    onChange(buttons.map((current, i) => (i === index ? button : current)));

  const hasPrefill = buttons.some((button) => button.kind === "admin" && button.prefill);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-chiziq">
        {buttons.map((button, index) => (
          <div key={index} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
              <Field label={copy.buttonKind} hideLabel>
                {({ id }) => (
                  <Select
                    id={id}
                    value={button.kind}
                    onValueChange={(next) => update(index, convert(button, next as TemplateButtonKind))}
                    options={kindOptions}
                  />
                )}
              </Field>
              <Field label={copy.buttonText} hideLabel className="order-last col-span-2 sm:order-none sm:col-span-1">
                {({ id }) => (
                  <Input
                    id={id}
                    value={button.text}
                    maxLength={64}
                    placeholder={copy.buttonText}
                    onChange={(e) => update(index, { ...button, text: e.target.value })}
                  />
                )}
              </Field>
              <IconButton
                label={copy.removeButton}
                icon={<CloseIcon className="h-5 w-5" />}
                onClick={() => onChange(buttons.filter((_, i) => i !== index))}
              />
            </div>
            {button.kind === "link" && (
              <Field label={copy.buttonUrlLabel} hideLabel>
                {({ id }) => (
                  <Input
                    id={id}
                    value={button.url}
                    inputMode="url"
                    placeholder={copy.buttonUrl}
                    onChange={(e) => update(index, { ...button, url: e.target.value })}
                  />
                )}
              </Field>
            )}
            {button.kind === "admin" && (
              <Field label={copy.buttonPrefill} hideLabel>
                {({ id }) => (
                  <Input
                    id={id}
                    value={button.prefill ?? ""}
                    maxLength={200}
                    placeholder={copy.buttonPrefill}
                    onChange={(e) => update(index, { ...button, prefill: e.target.value })}
                  />
                )}
              </Field>
            )}
          </div>
        ))}
      </div>

      {hasPrefill && !prefillSupported && <p className="m-0 text-[13px] text-anor">{copy.prefillUnsupported}</p>}

      {buttons.length < MAX_TEMPLATE_BUTTONS && (
        <div>
          <Button
            variant="secondary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={() => onChange([...buttons, { kind: "resume", text: buttonPresets.resume }])}
          >
            {copy.addButton}
          </Button>
        </div>
      )}
    </div>
  );
}
