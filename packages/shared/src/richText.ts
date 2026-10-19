import {
  escapeAttribute,
  escapeHtml,
  isTelegramLink,
  sanitizeTelegramHtml,
  TELEGRAM_LANGUAGE_PATTERN,
  templateVariables,
} from "./messages";
import { botTextDefinitions } from "./botTexts";

export type RichMark = { type: string; attrs?: Record<string, unknown> };

export type RichNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: RichMark[];
  content?: RichNode[];
};

type Seg = { kind: "text"; text: string; marks: RichMark[] } | { kind: "variable"; name: string; marks: RichMark[] } | { kind: "newline" };

type Container = { kind: "none" } | { kind: "quote"; expandable: boolean } | { kind: "pre"; language: string | null };

const MARK_ORDER = ["link", "bold", "italic", "underline", "strike", "spoiler", "code"] as const;

const MARK_TAGS: Record<string, string> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
  spoiler: "tg-spoiler",
  code: "code",
};

const TAG_MARKS: Record<string, string> = {
  b: "bold",
  i: "italic",
  u: "underline",
  s: "strike",
  "tg-spoiler": "spoiler",
};

const VARIABLE_PATTERN = /\{([A-Za-z_]+)\}/;

const botPlaceholderNames = new Set(Object.values(botTextDefinitions).flatMap((definition) => definition.placeholders));

function isKnownVariable(name: string): boolean {
  return (templateVariables as readonly string[]).includes(name) || botPlaceholderNames.has(name);
}

function emptyParagraph(): RichNode {
  return { type: "paragraph" };
}

function textNode(text: string, marks: RichMark[]): RichNode {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

function variableNode(name: string, marks: RichMark[]): RichNode {
  return marks.length > 0 ? { type: "variable", attrs: { name }, marks } : { type: "variable", attrs: { name } };
}

function splitVariables(text: string, marks: RichMark[]): Seg[] {
  const segs: Seg[] = [];
  const parts = text.split(new RegExp(VARIABLE_PATTERN.source, "g"));
  parts.forEach((part, index) => {
    if (index % 2 === 1 && isKnownVariable(part)) {
      segs.push({ kind: "variable", name: part, marks });
      return;
    }
    const literal = index % 2 === 1 ? `{${part}}` : part;
    if (literal) segs.push({ kind: "text", text: literal, marks });
  });
  return segs;
}

function segNodes(segs: Seg[]): RichNode[] {
  return segs.flatMap((seg) => {
    if (seg.kind === "variable") return [variableNode(seg.name, seg.marks)];
    if (seg.kind === "text") return [textNode(seg.text, seg.marks)];
    return [];
  });
}

function splitAtNewlines(segs: Seg[]): Seg[][] {
  const lines: Seg[][] = [[]];
  for (const seg of segs) {
    if (seg.kind === "newline") lines.push([]);
    else lines[lines.length - 1].push(seg);
  }
  return lines;
}

function paragraphsFrom(segs: Seg[]): RichNode[] {
  return splitAtNewlines(segs).map((line) =>
    line.length > 0 ? { type: "paragraph", content: segNodes(line) } : emptyParagraph(),
  );
}

function flushTopLevel(segs: Seg[], before: number, after: number): RichNode[] {
  let start = 0;
  let end = segs.length;
  while (start < end && start < before && segs[start].kind === "newline") start += 1;
  while (end > start && segs.length - end < after && segs[end - 1].kind === "newline") end -= 1;
  const consumed = start + (segs.length - end);
  const rest = segs.slice(start, end);
  if (rest.length > 0) return paragraphsFrom(rest);
  return consumed === before + after ? [emptyParagraph()] : [];
}

export function plainTextToDoc(text: string): RichNode {
  const content = text.split(/\r?\n/).map((line) => {
    const segs = splitVariables(line, []);
    return segs.length > 0 ? { type: "paragraph", content: segNodes(segs) } : emptyParagraph();
  });
  return { type: "doc", content };
}

export function telegramHtmlToDoc(html: string): RichNode {
  const sanitized = sanitizeTelegramHtml(html);
  if (!sanitized.ok) return plainTextToDoc(html);

  const counters: Record<string, number> = { bold: 0, italic: 0, underline: 0, strike: 0, spoiler: 0 };
  let href: string | null = null;
  let code = false;
  let container: Container = { kind: "none" };
  let topSegs: Seg[] = [];
  let containerSegs: Seg[] = [];
  let afterBlock = false;
  const blocks: RichNode[] = [];

  const currentMarks = (): RichMark[] => {
    if (code) return [{ type: "code" }];
    const marks: RichMark[] = [];
    for (const type of MARK_ORDER) {
      if (type === "link" && href !== null) marks.push({ type, attrs: { href } });
      else if (counters[type] > 0) marks.push({ type });
    }
    return marks;
  };

  const startBlock = (next: Container) => {
    blocks.push(...flushTopLevel(topSegs, afterBlock ? 1 : 0, 1));
    topSegs = [];
    containerSegs = [];
    container = next;
  };

  const endBlock = () => {
    if (container.kind === "quote") {
      blocks.push({
        type: "blockquote",
        attrs: { expandable: container.expandable },
        content: paragraphsFrom(containerSegs),
      });
    } else if (container.kind === "pre") {
      const nodes = segNodes(containerSegs);
      blocks.push({
        type: "codeBlock",
        attrs: { language: container.language },
        ...(nodes.length > 0 ? { content: nodes } : {}),
      });
    }
    container = { kind: "none" };
    afterBlock = true;
  };

  const pushText = (text: string) => {
    if (!text) return;
    if (container.kind === "pre") {
      containerSegs.push(...splitVariables(text, []));
      return;
    }
    const target = container.kind === "quote" ? containerSegs : topSegs;
    const marks = currentMarks();
    text.split("\n").forEach((line, index) => {
      if (index > 0) target.push({ kind: "newline" });
      target.push(...splitVariables(line, marks));
    });
  };

  for (const token of sanitized.tokens) {
    if (token.kind === "text") {
      pushText(token.text);
    } else if (token.kind === "open") {
      if (token.tag === "a") href = token.href;
      else if (token.tag === "code") code = true;
      else if (token.tag === "pre") startBlock({ kind: "pre", language: token.language ?? null });
      else if (token.tag === "blockquote") startBlock({ kind: "quote", expandable: token.expandable });
      else counters[TAG_MARKS[token.tag]] += 1;
    } else if (token.tag === "a") {
      href = null;
    } else if (token.tag === "code") {
      code = false;
    } else if (token.tag === "pre" || token.tag === "blockquote") {
      endBlock();
    } else {
      counters[TAG_MARKS[token.tag]] -= 1;
    }
  }
  blocks.push(...flushTopLevel(topSegs, afterBlock ? 1 : 0, 0));
  return { type: "doc", content: blocks };
}

function canonicalMarks(marks: RichMark[] | undefined): RichMark[] {
  const kept: RichMark[] = [];
  for (const mark of marks ?? []) {
    if (mark.type === "link") {
      const href = mark.attrs?.href;
      if (typeof href === "string" && isTelegramLink(href)) kept.push({ type: "link", attrs: { href } });
    } else if (mark.type in MARK_TAGS) {
      kept.push({ type: mark.type });
    }
  }
  if (kept.some((mark) => mark.type === "code")) return [{ type: "code" }];
  return MARK_ORDER.flatMap((type) => {
    const found = kept.find((mark) => mark.type === type);
    return found ? [found] : [];
  });
}

function markKey(mark: RichMark): string {
  return mark.type === "link" ? `link:${String(mark.attrs?.href)}` : mark.type;
}

function openTag(mark: RichMark): string {
  if (mark.type === "link") return `<a href="${escapeAttribute(String(mark.attrs?.href))}">`;
  return `<${MARK_TAGS[mark.type]}>`;
}

function closeTag(mark: RichMark): string {
  return mark.type === "link" ? "</a>" : `</${MARK_TAGS[mark.type]}>`;
}

function variableText(node: RichNode): string {
  const name = String(node.attrs?.name ?? "");
  return isKnownVariable(name) ? `{${name}}` : escapeHtml(`{${name}}`);
}

function serializeInline(nodes: RichNode[] | undefined): string {
  let output = "";
  let open: RichMark[] = [];
  const closeAll = () => {
    for (const mark of [...open].reverse()) output += closeTag(mark);
    open = [];
  };
  const moveTo = (next: RichMark[]) => {
    let common = 0;
    while (common < open.length && common < next.length && markKey(open[common]) === markKey(next[common])) {
      common += 1;
    }
    for (const mark of open.slice(common).reverse()) output += closeTag(mark);
    for (const mark of next.slice(common)) output += openTag(mark);
    open = next;
  };
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      closeAll();
      output += "\n";
    } else if (node.type === "variable") {
      moveTo(canonicalMarks(node.marks));
      output += variableText(node);
    } else if (node.type === "text" && node.text) {
      const marks = canonicalMarks(node.marks);
      node.text.split("\n").forEach((line, index) => {
        if (index > 0) {
          closeAll();
          output += "\n";
        }
        if (!line) return;
        moveTo(marks);
        output += escapeHtml(line);
      });
    }
  }
  closeAll();
  return output;
}

function serializeCodeBody(nodes: RichNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "variable") return variableText(node);
      return node.type === "text" ? escapeHtml(node.text ?? "") : "";
    })
    .join("");
}

function serializeBlock(node: RichNode): string {
  if (node.type === "blockquote") {
    const body = (node.content ?? []).map((child) => serializeInline(child.content)).join("\n");
    if (!body) return "";
    const open = node.attrs?.expandable === true ? "<blockquote expandable>" : "<blockquote>";
    return `${open}${body}</blockquote>`;
  }
  if (node.type === "codeBlock") {
    const body = serializeCodeBody(node.content);
    if (!body) return "";
    const language = node.attrs?.language;
    if (typeof language === "string" && TELEGRAM_LANGUAGE_PATTERN.test(language)) {
      return `<pre><code class="language-${language}">${body}</code></pre>`;
    }
    return `<pre>${body}</pre>`;
  }
  return serializeInline(node.content);
}

export function docToTelegramHtml(doc: RichNode): string {
  const blocks = (doc.content ?? []).map(serializeBlock);
  const kept = (doc.content ?? []).flatMap((node, index) =>
    blocks[index] === "" && (node.type === "blockquote" || node.type === "codeBlock") ? [] : [blocks[index]],
  );
  return kept.join("\n");
}
