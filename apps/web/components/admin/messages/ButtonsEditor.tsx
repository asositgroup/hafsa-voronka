"use client";

import {
  buttonPresets,
  MAX_TEMPLATE_BUTTONS,
  type TemplateButton,
  type TemplateButtonKind,
  templateButtonKinds,
} from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { PlusIcon } from "@/components/icons";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

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
      {buttons.map((button, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-[12px] bg-varaq p-3">
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <Field label={copy.buttonKind}>
              {({ id }) => (
                <Select id={id} value={button.kind} onChange={(e) => update(index, convert(button, e.target.value as TemplateButtonKind))}>
                  {templateButtonKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {copy.buttonKinds[kind]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={copy.buttonText}>
              {({ id }) => (
                <Input id={id} value={button.text} maxLength={64} onChange={(e) => update(index, { ...button, text: e.target.value })} />
              )}
            </Field>
          </div>
          {button.kind === "link" && (
            <Field label={copy.buttonUrlLabel}>
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
            <Field label={copy.buttonPrefill}>
              {({ id }) => (
                <Input id={id} value={button.prefill ?? ""} maxLength={200} onChange={(e) => update(index, { ...button, prefill: e.target.value })} />
              )}
            </Field>
          )}
          <div className="flex justify-end">
            <Button variant="dangerGhost" onClick={() => onChange(buttons.filter((_, i) => i !== index))}>
              {copy.removeButton}
            </Button>
          </div>
        </div>
      ))}

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
