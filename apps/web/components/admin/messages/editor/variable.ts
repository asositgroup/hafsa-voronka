import { InputRule, Node } from "@tiptap/core";
import { type EditorVariable, templateEditorVariables } from "@/components/admin/messages/editor/variables";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (name: string) => ReturnType;
    };
  }
}

export const Variable = Node.create<{ variables: EditorVariable[] }>({
  name: "variable",

  addOptions() {
    return { variables: templateEditorVariables };
  },

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-variable") ?? "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ node }) {
    const name = String(node.attrs.name);
    const label = this.options.variables.find((variable) => variable.name === name)?.label;
    return [
      "span",
      {
        "data-variable": name,
        class: "tg-variable",
        contenteditable: "false",
      },
      label ?? name,
    ];
  },

  renderText({ node }) {
    return `{${String(node.attrs.name)}}`;
  },

  addCommands() {
    return {
      insertVariable:
        (name) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { name } }),
    };
  },

  addInputRules() {
    const type = this.type;
    const variables = this.options.variables;
    return [
      new InputRule({
        find: /\{([A-Za-z_]+)\}$/,
        handler: ({ state, range, match }) => {
          if (!variables.some((variable) => variable.name === match[1])) return null;
          state.tr.replaceWith(range.from, range.to, type.create({ name: match[1] }));
          return undefined;
        },
      }),
    ];
  },
});
