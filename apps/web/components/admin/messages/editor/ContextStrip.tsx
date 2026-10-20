"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { isTelegramLink, TELEGRAM_LANGUAGE_PATTERN } from "@funnel/shared";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Field";
import { Switch } from "@/components/admin/ui/Switch";
import { readToolbarState } from "@/components/admin/messages/editor/toolbarState";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;
const errors = adminUz.messages.errors;

const stripClass = "flex flex-col gap-2 border-t border-chiziq bg-varaq/60 px-3 py-2 sm:flex-row sm:items-center";

type LinkFormProps = {
  editor: Editor;
  initialHref: string;
  onDone: () => void;
};

function LinkForm({ editor, initialHref, onDone }: LinkFormProps) {
  const [value, setValue] = useState(initialHref);
  const [invalid, setInvalid] = useState(false);
  const editing = initialHref !== "";

  function save() {
    const trimmed = value.trim();
    const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!trimmed || !isTelegramLink(href)) {
      setInvalid(true);
      return;
    }
    const { empty } = editor.state.selection;
    if (empty && !editing) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onDone();
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onDone();
  }

  return (
    <div className={stripClass}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Input
          value={value}
          invalid={invalid}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          placeholder={copy.linkPlaceholder}
          inputMode="url"
          aria-label={copy.link}
        />
        {invalid && (
          <span role="alert" className="text-[13px] text-anor">
            {errors.invalid_link}
          </span>
        )}
      </div>
      <div className="flex gap-2 self-start sm:self-auto">
        <Button onClick={save}>{copy.linkSave}</Button>
        {editing && (
          <Button variant="dangerGhost" onClick={remove}>
            {copy.linkRemove}
          </Button>
        )}
      </div>
    </div>
  );
}

function LanguageForm({ editor, initialLanguage }: { editor: Editor; initialLanguage: string }) {
  const [value, setValue] = useState(initialLanguage);
  const invalid = value !== "" && !TELEGRAM_LANGUAGE_PATTERN.test(value);

  function change(next: string) {
    setValue(next);
    if (next === "") editor.chain().updateAttributes("codeBlock", { language: null }).run();
    else if (TELEGRAM_LANGUAGE_PATTERN.test(next)) editor.chain().updateAttributes("codeBlock", { language: next }).run();
  }

  return (
    <div className={stripClass}>
      <label className="flex items-center gap-2 text-sm font-medium text-siyoh">
        <span className="shrink-0">{copy.codeLanguage}</span>
        <Input value={value} invalid={invalid} onChange={(event) => change(event.target.value)} placeholder="python" className="sm:w-48" />
      </label>
    </div>
  );
}

type ContextStripProps = {
  editor: Editor;
  linkOpen: boolean;
  onLinkDone: () => void;
};

export function ContextStrip({ editor, linkOpen, onLinkDone }: ContextStripProps) {
  const state = useEditorState({ editor, selector: ({ editor: current }) => readToolbarState(current) });

  if (linkOpen || state.link) {
    return <LinkForm key={state.linkHref || "new"} editor={editor} initialHref={state.linkHref} onDone={onLinkDone} />;
  }
  if (state.codeBlock) return <LanguageForm key={state.blockKey} editor={editor} initialLanguage={state.language} />;
  if (state.quote) {
    return (
      <div className={stripClass}>
        <Switch
          checked={state.expandable}
          label={copy.quoteExpandable}
          showLabel
          onChange={(expandable) => editor.chain().focus().updateAttributes("blockquote", { expandable }).run()}
        />
      </div>
    );
  }
  return null;
}
