import type { Editor } from "@tiptap/core";

export type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  spoiler: boolean;
  code: boolean;
  codeBlock: boolean;
  quote: boolean;
  link: boolean;
  canUndo: boolean;
  canRedo: boolean;
  linkHref: string;
  language: string;
  expandable: boolean;
  blockKey: string;
};

function enclosing(editor: Editor, name: string) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === name) return { node: $from.node(depth), pos: $from.before(depth) };
  }
  return null;
}

export function readToolbarState(editor: Editor): ToolbarState {
  const codeBlock = enclosing(editor, "codeBlock");
  const quote = enclosing(editor, "blockquote");
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    spoiler: editor.isActive("spoiler"),
    code: editor.isActive("code"),
    codeBlock: codeBlock !== null,
    quote: quote !== null,
    link: editor.isActive("link"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    linkHref: String(editor.getAttributes("link").href ?? ""),
    language: String(codeBlock?.node.attrs.language ?? ""),
    expandable: quote?.node.attrs.expandable === true,
    blockKey: String(codeBlock?.pos ?? quote?.pos ?? ""),
  };
}
