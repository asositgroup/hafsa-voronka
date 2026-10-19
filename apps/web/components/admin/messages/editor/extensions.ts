import type { Extensions } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import { isTelegramLink } from "@funnel/shared";
import { Spoiler } from "@/components/admin/messages/editor/spoiler";
import { Variable } from "@/components/admin/messages/editor/variable";
import type { EditorVariable } from "@/components/admin/messages/editor/variables";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;

const TelegramBlockquote = Blockquote.extend({
  content: "paragraph+",

  addAttributes() {
    return {
      expandable: {
        default: false,
        parseHTML: (element) => element.hasAttribute("expandable") || element.hasAttribute("data-expandable"),
        renderHTML: (attributes) => (attributes.expandable ? { "data-expandable": "" } : {}),
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        const quote = $from.node(-1);
        if (!empty || $from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) return false;
        if (!quote || quote.type.name !== "blockquote" || $from.index(-1) !== quote.childCount - 1) return false;
        return editor.commands.lift("blockquote");
      },
    };
  },
});

const TelegramCodeBlock = CodeBlock.extend({ content: "(text | variable)*" });

export function buildExtensions(variables?: EditorVariable[]): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Bold,
    Italic,
    Underline,
    Strike,
    Spoiler,
    Code,
    TelegramCodeBlock.configure({
      languageClassPrefix: "language-",
      defaultLanguage: null,
      exitOnTripleEnter: true,
      exitOnArrowDown: true,
    }),
    TelegramBlockquote,
    Link.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: true,
      protocols: ["tg"],
      defaultProtocol: "https",
      isAllowedUri: (url) => isTelegramLink(url),
    }),
    variables ? Variable.configure({ variables }) : Variable,
    UndoRedo,
    Placeholder.configure({ placeholder: copy.placeholder }),
  ];
}
