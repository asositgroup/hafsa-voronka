import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spoiler: {
      toggleSpoiler: () => ReturnType;
    };
  }
}

export const Spoiler = Mark.create({
  name: "spoiler",

  parseHTML() {
    return [{ tag: "tg-spoiler" }, { tag: "span.tg-spoiler" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "tg-spoiler" }), 0];
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-p": () => this.editor.commands.toggleSpoiler(),
    };
  },
});
