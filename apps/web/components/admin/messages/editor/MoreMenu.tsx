import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { CheckIcon, CodeBlockIcon, CodeIcon, QuoteIcon, RedoIcon, SpoilerIcon, UndoIcon } from "@/components/icons";
import type { ToolbarState } from "@/components/admin/messages/editor/toolbarState";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

type Row = { key: string; label: string; icon: ReactNode; active?: boolean; disabled?: boolean; run: () => void; compactHidden?: boolean };

type MoreMenuProps = {
  editor: Editor;
  state: ToolbarState;
  onDone: () => void;
};

export function MoreMenu({ editor, state, onDone }: MoreMenuProps) {
  const rows: Row[] = [
    {
      key: "spoiler",
      label: copy.spoiler,
      icon: <SpoilerIcon className="h-5 w-5" />,
      active: state.spoiler,
      run: () => editor.chain().focus().toggleSpoiler().run(),
    },
    {
      key: "code",
      label: copy.code,
      icon: <CodeIcon className="h-5 w-5" />,
      active: state.code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: "codeBlock",
      label: copy.codeBlock,
      icon: <CodeBlockIcon className="h-5 w-5" />,
      active: state.codeBlock,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      key: "quote",
      label: copy.quote,
      icon: <QuoteIcon className="h-5 w-5" />,
      active: state.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "undo",
      label: copy.undo,
      icon: <UndoIcon className="h-5 w-5" />,
      disabled: !state.canUndo,
      compactHidden: true,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      key: "redo",
      label: copy.redo,
      icon: <RedoIcon className="h-5 w-5" />,
      disabled: !state.canRedo,
      compactHidden: true,
      run: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <div role="menu" className="absolute right-2 top-full z-20 mt-1 w-60 rounded-[12px] border border-chiziq bg-white py-1 shadow-lg">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          role="menuitem"
          disabled={row.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            row.run();
            onDone();
          }}
          className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm text-siyoh hover:bg-varaq focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-siyoh disabled:opacity-35 ${
            row.compactHidden ? "sm:hidden" : ""
          }`}
        >
          {row.icon}
          <span className="flex-1">{row.label}</span>
          {row.active && <CheckIcon className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}
