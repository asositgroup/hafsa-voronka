"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { templateVariables } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input, Textarea } from "@/components/admin/ui/Field";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const toolButton =
  "h-9 min-w-9 rounded-[10px] border border-chegara/60 bg-white px-2.5 text-[13px] font-semibold text-siyoh transition-colors hover:border-siyoh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh";

type RichTextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  error: string | null;
  counter: ReactNode;
};

export function RichTextField({ value, onChange, invalid, error, counter }: RichTextFieldProps) {
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
    <Field label={copy.text} error={error} counter={counter}>
      {({ id, describedBy, invalid: fieldInvalid }) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-label="bold" onClick={() => wrap("b")} className={toolButton}>
              {copy.bold}
            </button>
            <button type="button" aria-label="italic" onClick={() => wrap("i")} className={`${toolButton} italic`}>
              {copy.italic}
            </button>
            <button type="button" aria-expanded={linkOpen} onClick={() => setLinkOpen((open) => !open)} className={toolButton}>
              {copy.link}
            </button>
          </div>

          {linkOpen && (
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder={copy.linkPlaceholder}
                inputMode="url"
                aria-label={copy.link}
              />
              <Button onClick={applyLink}>{copy.linkApply}</Button>
            </div>
          )}

          <Textarea
            id={id}
            ref={textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={7}
            aria-describedby={describedBy}
            invalid={invalid || fieldInvalid}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-qalam">{copy.variables}</span>
            {templateVariables.map((variable) => (
              <button
                key={variable}
                type="button"
                title={copy.variableHints[variable]}
                onClick={() => replaceSelection(() => `{${variable}}`)}
                className="h-9 rounded-full bg-varaq px-3 text-[13px] font-semibold text-siyoh transition-colors hover:bg-chiziq focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-siyoh"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}
