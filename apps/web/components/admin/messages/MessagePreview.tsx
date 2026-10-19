"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import {
  buttonPresets,
  isTelegramLink,
  SAMPLE_CONTEXT,
  sanitizeTelegramHtml,
  telegramHtmlToDoc,
  type RichMark,
  type RichNode,
  type TemplateButton,
  variableValues,
} from "@funnel/shared";
import { adminUz } from "@/lib/i18n/admin";

const copy = adminUz.messages.editor;
const sampleValues = variableValues(SAMPLE_CONTEXT);

function SpoilerText({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={revealed}
      onClick={() => setRevealed((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setRevealed((current) => !current);
        }
      }}
      className={`cursor-pointer rounded-[3px] focus-visible:outline-2 focus-visible:outline-siyoh ${
        revealed ? "bg-varaq" : "select-none blur-[4px] motion-reduce:bg-qalam motion-reduce:text-transparent motion-reduce:blur-none"
      }`}
    >
      {children}
    </span>
  );
}

function wrapMark(mark: RichMark, child: ReactNode, key: string): ReactNode {
  switch (mark.type) {
    case "bold":
      return <b key={key}>{child}</b>;
    case "italic":
      return <i key={key}>{child}</i>;
    case "underline":
      return (
        <span key={key} className="underline">
          {child}
        </span>
      );
    case "strike":
      return (
        <span key={key} className="line-through">
          {child}
        </span>
      );
    case "spoiler":
      return <SpoilerText key={key}>{child}</SpoilerText>;
    case "code":
      return (
        <code key={key} className="rounded bg-varaq px-1 font-mono text-[13px]">
          {child}
        </code>
      );
    case "link": {
      const href = String(mark.attrs?.href ?? "");
      return (
        <span key={key} className="text-[#2a7bd0] underline" title={isTelegramLink(href) ? href : undefined}>
          {child}
        </span>
      );
    }
    default:
      return child;
  }
}

type Samples = { values: Record<string, string>; chips: boolean };

const SamplesContext = createContext<Samples>({ values: sampleValues, chips: false });

function VariableValue({ name }: { name: string }) {
  const { values, chips } = useContext(SamplesContext);
  if (!chips) return <>{values[name] ?? ""}</>;
  return <span className="rounded-full bg-varaq px-2 py-px text-[0.9em] font-semibold">{values[name] ?? name}</span>;
}

function inlineNode(node: RichNode, key: string): ReactNode {
  const content = node.type === "variable" ? <VariableValue name={String(node.attrs?.name)} /> : (node.text ?? "");
  return [...(node.marks ?? [])]
    .reverse()
    .reduce<ReactNode>((child, mark, index) => wrapMark(mark, child, `${key}-${index}`), content);
}

function inlineContent(nodes: RichNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) =>
    node.type === "hardBreak" ? <br key={index} /> : <span key={index}>{inlineNode(node, `m${index}`)}</span>,
  );
}

function Paragraph({ node }: { node: RichNode }) {
  return <div>{node.content && node.content.length > 0 ? inlineContent(node.content) : <br />}</div>;
}

function Quote({ node }: { node: RichNode }) {
  const expandable = node.attrs?.expandable === true;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-r border-l-[3px] border-[#2a7bd0] bg-[#2a7bd0]/8 py-0.5 pl-2 pr-2">
      <div className={expandable && !expanded ? "line-clamp-3" : ""}>
        {(node.content ?? []).map((child, index) => (
          <Paragraph key={index} node={child} />
        ))}
      </div>
      {expandable && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="min-h-6 text-[13px] font-medium text-[#2a7bd0] focus-visible:outline-2 focus-visible:outline-siyoh"
        >
          {copy.showMore}
        </button>
      )}
    </div>
  );
}

function CodeBlock({ node }: { node: RichNode }) {
  const language = typeof node.attrs?.language === "string" ? node.attrs.language : null;

  return (
    <div className="rounded bg-varaq p-2">
      {language && <div className="mb-1 text-xs text-qalam">{language}</div>}
      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[13px]">
        {(node.content ?? []).map((child, index) => (
          <span key={index}>{inlineNode(child, `c${index}`)}</span>
        ))}
      </pre>
    </div>
  );
}

function Block({ node }: { node: RichNode }) {
  if (node.type === "blockquote") return <Quote node={node} />;
  if (node.type === "codeBlock") return <CodeBlock node={node} />;
  return <Paragraph node={node} />;
}

type RichTextViewProps = {
  text: string;
  samples?: Record<string, string>;
  chips?: boolean;
  empty?: ReactNode;
};

export function RichTextView({ text, samples = sampleValues, chips = false, empty }: RichTextViewProps) {
  const sanitized = sanitizeTelegramHtml(text);
  const blocks = sanitized.ok && text.trim() ? (telegramHtmlToDoc(sanitized.html).content ?? []) : null;

  return (
    <SamplesContext.Provider value={{ values: samples, chips }}>
      {blocks ? blocks.map((node, index) => <Block key={index} node={node} />) : (empty ?? <span className="text-qalam">{copy.previewEmpty}</span>)}
    </SamplesContext.Provider>
  );
}

type MessagePreviewProps = {
  text: string;
  buttons: TemplateButton[];
};

export function MessagePreview({ text, buttons }: MessagePreviewProps) {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-varaq p-3">
      <div className="flex max-w-[340px] flex-col gap-0.5 whitespace-pre-wrap break-words rounded-[12px] rounded-bl-[4px] bg-white px-3 py-2 text-sm leading-[1.45] text-siyoh">
        <RichTextView text={text} />
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
