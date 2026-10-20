import type { Editor } from "@tiptap/core";
import type { EditorVariable } from "@/components/admin/messages/editor/variables";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

type VariableMenuProps = {
  editor: Editor;
  variables: EditorVariable[];
  onDone: () => void;
};

export function VariableMenu({ editor, variables, onDone }: VariableMenuProps) {
  return (
    <div
      role="menu"
      aria-label={copy.variableMenu}
      className="absolute right-2 top-full z-20 mt-1 w-72 max-w-[calc(100%-16px)] rounded-[12px] border border-chiziq bg-white py-1 shadow-lg"
    >
      {variables.map(({ name, label, sample }) => (
        <button
          key={name}
          type="button"
          role="menuitem"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            editor.chain().focus().insertVariable(name).run();
            onDone();
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm text-siyoh hover:bg-varaq focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-siyoh"
        >
          <span className="font-medium">{label}</span>
          <span className="min-w-0 truncate text-[13px] text-qalam">{sample}</span>
        </button>
      ))}
    </div>
  );
}
