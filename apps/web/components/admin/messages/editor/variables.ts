import { SAMPLE_CONTEXT, templateVariables, variableValues } from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

export type EditorVariable = { name: string; label: string; sample: string };

const sampleValues = variableValues(SAMPLE_CONTEXT);

export const templateEditorVariables: EditorVariable[] = templateVariables.map((name) => ({
  name,
  label: adminUz.messages.editor.variableHints[name],
  sample: sampleValues[name],
}));
