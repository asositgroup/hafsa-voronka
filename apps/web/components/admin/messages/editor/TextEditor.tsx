"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import { docToTelegramHtml, plainTextToDoc, telegramHtmlToDoc } from "@funnel/shared";
import { Field } from "@/components/admin/ui/Field";
import { ContextStrip } from "@/components/admin/messages/editor/ContextStrip";
import { buildExtensions } from "@/components/admin/messages/editor/extensions";
import { type EditorVariable, templateEditorVariables } from "@/components/admin/messages/editor/variables";
import { Toolbar } from "@/components/admin/messages/editor/Toolbar";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

type TextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  error: string | null;
  counter: ReactNode;
  variables?: EditorVariable[];
  label?: string;
};

export function TextEditor({ value, onChange, invalid, error, counter, variables = templateEditorVariables, label = copy.text }: TextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const latestOnChange = useRef(onChange);

  useEffect(() => {
    latestOnChange.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: buildExtensions(variables),
    content: telegramHtmlToDoc(value),
    editorProps: {
      attributes: { class: "tg-editor-content", "aria-label": label, "aria-multiline": "true" },
      clipboardTextParser(text, $context, _plain, view) {
        const normalized = text.replace(/\r\n?/g, "\n");
        if ($context.parent.type.spec.code) {
          return normalized ? new Slice(Fragment.from(view.state.schema.text(normalized)), 0, 0) : Slice.empty;
        }
        const doc = view.state.schema.nodeFromJSON(plainTextToDoc(normalized));
        return Slice.maxOpen(doc.content);
      },
    },
    onUpdate: ({ editor: current }) => latestOnChange.current(docToTelegramHtml(current.getJSON())),
  });

  const closeLink = useCallback(() => setLinkOpen(false), []);

  return (
    <Field label={label} error={error} counter={counter}>
      {({ id, describedBy, invalid: fieldInvalid }) => (
        <TextEditorSurface
          id={id}
          describedBy={describedBy}
          invalid={invalid || fieldInvalid}
          editor={editor}
          variables={variables}
          linkOpen={linkOpen}
          onToggleLink={() => setLinkOpen((open) => !open)}
          onLinkDone={closeLink}
        />
      )}
    </Field>
  );
}

type SurfaceProps = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  editor: Editor | null;
  variables: EditorVariable[];
  linkOpen: boolean;
  onToggleLink: () => void;
  onLinkDone: () => void;
};

function TextEditorSurface({ id, describedBy, invalid, editor, variables, linkOpen, onToggleLink, onLinkDone }: SurfaceProps) {
  useEffect(() => {
    const element = editor?.view.dom;
    if (!element) return;
    element.setAttribute("id", id);
    if (describedBy) element.setAttribute("aria-describedby", describedBy);
    else element.removeAttribute("aria-describedby");
    if (invalid) element.setAttribute("aria-invalid", "true");
    else element.removeAttribute("aria-invalid");
  }, [editor, id, describedBy, invalid]);

  return (
    <div
      className={`rounded-[10px] border bg-white transition-colors focus-within:border-siyoh focus-within:ring-2 focus-within:ring-siyoh/15 ${
        invalid ? "border-anor" : "border-chegara/60"
      }`}
    >
      <div className="sticky top-0 z-10 rounded-t-[10px] border-b border-chiziq bg-white">
        {editor && <Toolbar editor={editor} variables={variables} linkOpen={linkOpen} onToggleLink={onToggleLink} />}
        {editor && <ContextStrip editor={editor} linkOpen={linkOpen} onLinkDone={onLinkDone} />}
      </div>
      <EditorContent editor={editor} className="tg-editor" />
    </div>
  );
}
