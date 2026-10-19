"use client";

import { useRef, useState } from "react";
import { templateVariables } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const toolButton =
  "h-8 min-w-8 rounded-[8px] border border-chegara/60 px-2 text-[13px] font-semibold text-siyoh transition-colors hover:border-siyoh";

type RichTextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
};

export function RichTextField({ value, onChange, invalid }: RichTextFieldProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  function replaceSelection(build: (selected: string) => string) {
    const element = textarea.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const inserted = build(value.slice(start, end));
    onChange(value.slice(0, start) + inserted + value.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  }

  const wrap = (tag: "b" | "i") => replaceSelection((selected) => `<${tag}>${selected}</${tag}>`);

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) return;
    replaceSelection((selected) => `<a href="${url.replace(/"/g, "&quot;")}">${selected || url}</a>`);
    setLinkUrl("");
    setLinkOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-label="bold" onClick={() => wrap("b")} className={toolButton}>
          {copy.bold}
        </button>
        <button type="button" aria-label="italic" onClick={() => wrap("i")} className={`${toolButton} italic`}>
          {copy.italic}
        </button>
        <button type="button" onClick={() => setLinkOpen((open) => !open)} className={toolButton}>
          {copy.link}
        </button>
      </div>

      {linkOpen && (
        <div className="flex gap-2">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={copy.linkPlaceholder}
            inputMode="url"
            className="h-9 min-w-0 flex-1 rounded-[10px] border border-chegara/60 bg-white px-3 text-sm text-siyoh outline-none focus:border-siyoh"
          />
          <button type="button" onClick={applyLink} className="h-9 rounded-[9px] bg-siyoh px-3 text-[13px] font-semibold text-varaq">
            {copy.linkApply}
          </button>
        </div>
      )}

      <textarea
        ref={textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        aria-label={copy.text}
        aria-invalid={invalid}
        className="resize-y rounded-[10px] border border-chegara/60 bg-white px-3 py-2.5 text-sm leading-[1.5] text-siyoh outline-none focus:border-siyoh focus:ring-2 focus:ring-siyoh/15"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-qalam">{copy.variables}</span>
        {templateVariables.map((variable) => (
          <button
            key={variable}
            type="button"
            title={copy.variableHints[variable]}
            onClick={() => replaceSelection(() => `{${variable}}`)}
            className="h-7 rounded-full bg-oltin/20 px-2.5 text-xs font-semibold text-siyoh transition-opacity hover:opacity-80"
          >
            {`{${variable}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
