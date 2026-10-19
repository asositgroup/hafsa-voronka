"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  MoreIcon,
  RedoIcon,
  StrikeIcon,
  UnderlineIcon,
  UndoIcon,
  VariableIcon,
} from "@/components/icons";
import { MoreMenu } from "@/components/admin/messages/editor/MoreMenu";
import { ToolButton } from "@/components/admin/messages/editor/ToolButton";
import { readToolbarState } from "@/components/admin/messages/editor/toolbarState";
import type { EditorVariable } from "@/components/admin/messages/editor/variables";
import { VariableMenu } from "@/components/admin/messages/editor/VariableMenu";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

type ToolbarProps = {
  editor: Editor;
  linkOpen: boolean;
  variables: EditorVariable[];
  onToggleLink: () => void;
};

export function Toolbar({ editor, linkOpen, variables, onToggleLink }: ToolbarProps) {
  const [menu, setMenu] = useState<"more" | "variable" | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const state = useEditorState({ editor, selector: ({ editor: current }) => readToolbarState(current) });

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const toggleMenu = (next: "more" | "variable") => setMenu((current) => (current === next ? null : next));

  return (
    <div ref={container} className="relative">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        <ToolButton label={copy.bold} pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton label={copy.italic} pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton label={copy.underline} pressed={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton label={copy.strike} pressed={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <StrikeIcon className="h-5 w-5" />
        </ToolButton>
        <ToolButton label={copy.link} pressed={state.link || linkOpen} onClick={onToggleLink}>
          <LinkIcon className="h-5 w-5" />
        </ToolButton>
        {variables.length > 0 && (
          <ToolButton label={copy.variableMenu} expanded={menu === "variable"} onClick={() => toggleMenu("variable")}>
            <VariableIcon className="h-5 w-5" />
          </ToolButton>
        )}
        <ToolButton label={copy.more} expanded={menu === "more"} onClick={() => toggleMenu("more")}>
          <MoreIcon className="h-5 w-5" />
        </ToolButton>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          <ToolButton label={copy.undo} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <UndoIcon className="h-5 w-5" />
          </ToolButton>
          <ToolButton label={copy.redo} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            <RedoIcon className="h-5 w-5" />
          </ToolButton>
        </span>
      </div>
      {menu === "more" && <MoreMenu editor={editor} state={state} onDone={() => setMenu(null)} />}
      {menu === "variable" && <VariableMenu editor={editor} variables={variables} onDone={() => setMenu(null)} />}
    </div>
  );
}
