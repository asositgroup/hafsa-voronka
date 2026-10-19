"use client";

import {
  buttonPresets,
  MAX_TEMPLATE_BUTTONS,
  type TemplateButton,
  type TemplateButtonKind,
  templateButtonKinds,
} from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const fieldClass =
  "h-10 min-w-0 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh";

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
        <div key={index} className="flex flex-col gap-2 rounded-[12px] border border-chiziq p-3">
          <div className="flex gap-2">
            <select
              value={button.kind}
              onChange={(e) => update(index, convert(button, e.target.value as TemplateButtonKind))}
              aria-label={copy.buttonsTitle}
              className={`${fieldClass} w-44 shrink-0`}
            >
              {templateButtonKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {copy.buttonKinds[kind]}
                </option>
              ))}
            </select>
            <input
              value={button.text}
              maxLength={64}
              onChange={(e) => update(index, { ...button, text: e.target.value })}
              placeholder={copy.buttonText}
              aria-label={copy.buttonText}
              className={`${fieldClass} flex-1`}
            />
          </div>
          {button.kind === "link" && (
            <input
              value={button.url}
              onChange={(e) => update(index, { ...button, url: e.target.value })}
              placeholder={copy.buttonUrl}
              inputMode="url"
              aria-label={copy.buttonUrl}
              className={fieldClass}
            />
          )}
          {button.kind === "admin" && (
            <input
              value={button.prefill ?? ""}
              maxLength={200}
              onChange={(e) => update(index, { ...button, prefill: e.target.value })}
              placeholder={copy.buttonPrefill}
              aria-label={copy.buttonPrefill}
              className={fieldClass}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(buttons.filter((_, i) => i !== index))}
            className="self-end text-xs font-medium text-qalam transition-colors hover:text-anor"
          >
            {copy.removeButton}
          </button>
        </div>
      ))}

      {hasPrefill && !prefillSupported && <p className="m-0 text-xs text-anor">{copy.prefillUnsupported}</p>}

      {buttons.length < MAX_TEMPLATE_BUTTONS && (
        <button
          type="button"
          onClick={() => onChange([...buttons, { kind: "resume", text: buttonPresets.resume }])}
          className="h-9 self-start rounded-[9px] border border-chegara/60 px-3 text-[13px] font-medium text-siyoh transition-colors hover:border-siyoh"
        >
          {copy.addButton}
        </button>
      )}
    </div>
  );
}
