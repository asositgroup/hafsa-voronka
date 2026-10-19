import type { ReactNode } from "react";
import {
  buttonPresets,
  type HtmlToken,
  renderPlainText,
  SAMPLE_CONTEXT,
  sanitizeTelegramHtml,
  type TemplateButton,
  variableValues,
} from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;
const sampleValues = variableValues(SAMPLE_CONTEXT);

type Frame = { tag: "b" | "i" | "a"; children: ReactNode[] };

function buildNodes(tokens: HtmlToken[]): ReactNode[] {
  const root: ReactNode[] = [];
  const stack: Frame[] = [];
  let key = 0;
  const target = () => (stack.length > 0 ? stack[stack.length - 1].children : root);

  for (const token of tokens) {
    if (token.kind === "text") {
      target().push(renderPlainText(token.text, sampleValues));
    } else if (token.kind === "open") {
      stack.push({ tag: token.tag, children: [] });
    } else {
      const frame = stack.pop();
      if (!frame) continue;
      key += 1;
      const node =
        frame.tag === "b" ? (
          <b key={key}>{frame.children}</b>
        ) : frame.tag === "i" ? (
          <i key={key}>{frame.children}</i>
        ) : (
          <span key={key} className="text-[#2a7bd0] underline">
            {frame.children}
          </span>
        );
      target().push(node);
    }
  }
  return root;
}

type MessagePreviewProps = {
  text: string;
  buttons: TemplateButton[];
};

export function MessagePreview({ text, buttons }: MessagePreviewProps) {
  const sanitized = sanitizeTelegramHtml(text);

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
      <div className="max-w-[340px] whitespace-pre-wrap break-words rounded-[12px] rounded-bl-[4px] bg-white px-3 py-2 text-sm leading-[1.45] text-siyoh">
        {sanitized.ok && text.trim() ? buildNodes(sanitized.tokens) : <span className="text-qalam">{copy.previewEmpty}</span>}
      </div>
      {buttons.length > 0 && (
        <div className="flex max-w-[340px] flex-col gap-1">
          {buttons.map((button, index) => (
            <div
              key={index}
              className="rounded-[10px] bg-white/70 px-3 py-1.5 text-center text-[13px] font-medium text-[#2a7bd0]"
            >
              {button.text || buttonPresets[button.kind as keyof typeof buttonPresets] || "…"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
