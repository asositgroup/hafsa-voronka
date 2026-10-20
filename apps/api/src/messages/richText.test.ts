import { describe, expect, it } from "vitest";
import {
  docToTelegramHtml,
  plainTextToDoc,
  sanitizeTelegramHtml,
  telegramHtmlToDoc,
  validateTemplateText,
  visibleLength,
  type RichNode,
} from "@funnel/shared";

function sanitizedHtml(input: string): string {
  const result = sanitizeTelegramHtml(input);
  if (!result.ok) throw new Error(result.error);
  return result.html;
}

function f(input: string): string {
  return docToTelegramHtml(telegramHtmlToDoc(input));
}

type StyledChar = { ch: string; marks: string; block: string };

function styledChars(html: string): StyledChar[] {
  const result = sanitizeTelegramHtml(html);
  if (!result.ok) throw new Error(result.error);
  const marks: string[] = [];
  let block = "p";
  const chars: StyledChar[] = [];
  for (const token of result.tokens) {
    if (token.kind === "text") {
      for (const ch of token.text) {
        if (ch === "\n") continue;
        chars.push({ ch, marks: [...new Set(marks)].sort().join(","), block });
      }
    } else if (token.kind === "open") {
      if (token.tag === "pre") block = `pre:${token.language ?? ""}`;
      else if (token.tag === "blockquote") block = token.expandable ? "quote+exp" : "quote";
      else marks.push(token.tag === "a" ? `a:${token.href}` : token.tag);
    } else if (token.tag === "pre" || token.tag === "blockquote") {
      block = "p";
    } else {
      const index = marks.findLastIndex((mark) => mark === token.tag || (token.tag === "a" && mark.startsWith("a:")));
      marks.splice(index, 1);
    }
  }
  return chars;
}

function expectInvariants(input: string, options: { canonical?: boolean; exactStyles?: boolean } = {}) {
  const output = f(input);
  const resanitized = sanitizeTelegramHtml(output);
  expect(resanitized.ok).toBe(true);
  expect(resanitized.ok && resanitized.html).toBe(output);
  expect(f(output)).toBe(output);
  if (options.exactStyles !== false) expect(styledChars(output)).toEqual(styledChars(sanitizedHtml(input)));
  if (options.canonical) expect(output).toBe(input);
}

function blocksOf(input: string) {
  return (telegramHtmlToDoc(input).content ?? []).map((node) => node.type);
}

describe("plain text and lines", () => {
  it("round-trips plain text", () => {
    expectInvariants("Salom", { canonical: true });
    expectInvariants("a\nb", { canonical: true });
  });

  it("keeps empty lines", () => {
    expectInvariants("\na\n\n\nb\n", { canonical: true });
    expect(blocksOf("\na\n\n\nb\n")).toHaveLength(6);
  });

  it("turns empty input into one empty paragraph", () => {
    expect(telegramHtmlToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expectInvariants("", { canonical: true });
  });

  it("keeps whitespace-only lines", () => {
    expectInvariants("  \n ", { canonical: true });
  });
});

describe("inline marks", () => {
  it("round-trips nested marks", () => {
    expectInvariants("<b>a <i>b</i> <u>c</u> <s>d</s> <tg-spoiler>e</tg-spoiler></b>", { canonical: true });
  });

  it("orders nested marks canonically", () => {
    expect(f("<i><b>x</b></i>")).toBe("<b><i>x</i></b>");
    expectInvariants("<i><b>x</b></i>");
  });

  it("merges adjacent identical marks", () => {
    expect(f("<b>a</b><b>b</b>")).toBe("<b>ab</b>");
    expectInvariants("<b>a</b><b>b</b>");
  });

  it("closes marks around newlines", () => {
    expect(f("<b>a\nb</b>")).toBe("<b>a</b>\n<b>b</b>");
    expectInvariants("<b>a\nb</b>");
  });
});

describe("links", () => {
  it("round-trips links", () => {
    expectInvariants('<a href="https://t.me/x"><b>bu</b> yer</a>', { canonical: true });
    expectInvariants('<a href="tg://user?id=1">Ali</a>', { canonical: true });
  });

  it("moves links outside other marks", () => {
    expect(f('<b><a href="https://t.me/x">x</a></b>')).toBe('<a href="https://t.me/x"><b>x</b></a>');
    expectInvariants('<b><a href="https://t.me/x">x</a></b>');
  });

  it("keeps adjacent different links separate", () => {
    expectInvariants('<a href="https://a.uz">a</a><a href="https://b.uz">b</a>', { canonical: true });
  });

  it("normalises quotes", () => {
    expect(f("<a href='https://a.uz'>a</a>")).toBe('<a href="https://a.uz">a</a>');
  });
});

describe("code", () => {
  it("round-trips inline code", () => {
    expectInvariants("a <code>x &lt; y</code> b", { canonical: true });
  });

  it("keeps a variable inside code", () => {
    expectInvariants("<code>{ism}</code>", { canonical: true });
    const doc = telegramHtmlToDoc("<code>{ism}</code>");
    expect(doc.content?.[0].content).toEqual([{ type: "variable", attrs: { name: "ism" }, marks: [{ type: "code" }] }]);
  });
});

describe("pre", () => {
  it("keeps newlines inside one code block", () => {
    expectInvariants("<pre>l1\nl2</pre>", { canonical: true });
    const doc = telegramHtmlToDoc("<pre>l1\nl2</pre>");
    expect(doc.content).toEqual([
      { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "l1\nl2" }] },
    ]);
  });

  it("keeps the language", () => {
    const html = '<pre><code class="language-python">x</code></pre>';
    expectInvariants(html, { canonical: true });
    expect(telegramHtmlToDoc(html).content?.[0].attrs?.language).toBe("python");
  });

  it("keeps variables", () => {
    expectInvariants("<pre>{ism}</pre>", { canonical: true });
  });

  it("drops empty pre", () => {
    expect(f("<pre></pre>")).toBe("");
  });
});

describe("blockquote", () => {
  it("round-trips quotes between lines", () => {
    expectInvariants("a\n<blockquote>q1\nq2</blockquote>\nb", { canonical: true });
    expectInvariants("<blockquote expandable>q</blockquote>", { canonical: true });
  });

  it("keeps blank lines around quotes", () => {
    expectInvariants("<blockquote>q</blockquote>\n\nb", { canonical: true });
    expect(blocksOf("<blockquote>q</blockquote>\n\nb")).toEqual(["blockquote", "paragraph", "paragraph"]);
    expectInvariants("\n<blockquote>q</blockquote>", { canonical: true });
    expectInvariants("<blockquote>q</blockquote>\n", { canonical: true });
  });

  it("puts nothing between adjacent quotes", () => {
    expectInvariants("<blockquote>a</blockquote>\n<blockquote>b</blockquote>", { canonical: true });
    expect(blocksOf("<blockquote>a</blockquote>\n<blockquote>b</blockquote>")).toEqual(["blockquote", "blockquote"]);
  });

  it("adds the missing separator", () => {
    expect(f("a<blockquote>q</blockquote>b")).toBe("a\n<blockquote>q</blockquote>\nb");
    expectInvariants("a<blockquote>q</blockquote>b");
  });

  it("splits marks around a quote", () => {
    expect(f("<b>x<blockquote>q</blockquote></b>")).toBe("<b>x</b>\n<blockquote><b>q</b></blockquote>");
    expectInvariants("<b>x<blockquote>q</blockquote></b>");
  });

  it("keeps links inside quotes", () => {
    expectInvariants('<blockquote>q <a href="https://x.uz">l</a></blockquote>', { canonical: true });
  });
});

describe("variables", () => {
  it("turns known variables into nodes", () => {
    expectInvariants("Salom, {ism}!", { canonical: true });
    expect(telegramHtmlToDoc("Salom, {ism}!").content?.[0].content?.map((node) => node.type)).toEqual([
      "text",
      "variable",
      "text",
    ]);
    expectInvariants("<b>{ism}</b>{qolgan_vaqt}<i>x</i>", { canonical: true });
  });

  it("leaves unknown variables as text", () => {
    expectInvariants("{foo}", { canonical: true });
    expect(telegramHtmlToDoc("{foo}").content?.[0].content).toEqual([{ type: "text", text: "{foo}" }]);
    expect(validateTemplateText(f("{foo}"), false)).toEqual({ error: "unknown_variable", variable: "foo" });
  });
});

describe("escaping", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(f("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expectInvariants("a & b < c > d");
    expectInvariants("&amp;lt;", { canonical: true });
    expect(f("&quot;")).toBe('"');
  });
});

describe("docToTelegramHtml on hand-built docs", () => {
  const doc = (...content: RichNode[]): RichNode => ({ type: "doc", content });
  const paragraph = (...content: RichNode[]): RichNode => ({ type: "paragraph", content });

  it("treats a hard break like a paragraph boundary", () => {
    const withBreak = doc(
      paragraph({ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }),
    );
    const withParagraphs = doc(paragraph({ type: "text", text: "a" }), paragraph({ type: "text", text: "b" }));
    expect(docToTelegramHtml(withBreak)).toBe(docToTelegramHtml(withParagraphs));
  });

  it("drops unknown marks and treats unknown blocks as paragraphs", () => {
    expect(
      docToTelegramHtml(
        doc(
          paragraph({ type: "text", text: "a", marks: [{ type: "highlight" }] }),
          { type: "heading", content: [{ type: "text", text: "b" }] },
        ),
      ),
    ).toBe("a\nb");
  });

  it("drops unsafe links", () => {
    expect(
      docToTelegramHtml(
        doc(paragraph({ type: "text", text: "a", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] })),
      ),
    ).toBe("a");
  });

  it("keeps only code when code is combined with other marks", () => {
    expect(
      docToTelegramHtml(doc(paragraph({ type: "text", text: "a", marks: [{ type: "bold" }, { type: "code" }] }))),
    ).toBe("<code>a</code>");
  });

  it("drops an invalid language", () => {
    expect(
      docToTelegramHtml(
        doc({ type: "codeBlock", attrs: { language: 'a b"' }, content: [{ type: "text", text: "x" }] }),
      ),
    ).toBe("<pre>x</pre>");
  });
});

describe("invalid input", () => {
  it("falls back to plain text", () => {
    expect(telegramHtmlToDoc("<b>x")).toEqual(plainTextToDoc("<b>x"));
    expect(f("<b>x")).toBe("&lt;b&gt;x");
    expect(telegramHtmlToDoc("<code><b>x</b></code>")).toEqual(plainTextToDoc("<code><b>x</b></code>"));
  });
});

describe("plainTextToDoc", () => {
  it("makes paragraphs and variables", () => {
    const doc = plainTextToDoc("a\n\n{ism}");
    expect(doc.content).toHaveLength(3);
    expect(doc.content?.[2].content).toEqual([{ type: "variable", attrs: { name: "ism" } }]);
  });
});

describe("length parity", () => {
  it("measures the canonical output like the source", () => {
    const source = "<strong>{ism}</strong> &#39;x&#39;";
    expect(visibleLength(f(source))).toBe(visibleLength(sanitizedHtml(source)));
  });
});

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPENERS: [string, string][] = [
  ["<b>", "</b>"],
  ["<strong>", "</strong>"],
  ["<i>", "</i>"],
  ["<u>", "</u>"],
  ["<s>", "</s>"],
  ["<del>", "</del>"],
  ["<tg-spoiler>", "</tg-spoiler>"],
  ['<span class="tg-spoiler">', "</span>"],
  ['<a href="https://x.uz/a?b=1&amp;c=2">', "</a>"],
  ["<code>", "</code>"],
  ["<pre>", "</pre>"],
  ['<pre><code class="language-py">', "</code></pre>"],
  ["<blockquote>", "</blockquote>"],
  ["<blockquote expandable>", "</blockquote>"],
];

const PIECES = ["a", "b c", " ", "\n", "\n", "&", "<", ">", "{ism}", "{qolgan_vaqt}", "{x}", "&amp;", "&#39;", "x\ny"];

function randomHtml(random: () => number): string {
  const closers: string[] = [];
  let output = "";
  const steps = 2 + Math.floor(random() * 10);
  for (let step = 0; step < steps; step += 1) {
    const roll = random();
    if (roll < 0.4) {
      output += PIECES[Math.floor(random() * PIECES.length)];
    } else if (roll < 0.75) {
      const [open, close] = OPENERS[Math.floor(random() * OPENERS.length)];
      output += open;
      closers.push(close);
    } else if (closers.length > 0) {
      output += closers.pop();
    }
  }
  while (closers.length > 0) output += closers.pop();
  return output;
}

describe("seeded random sweep", () => {
  it("keeps the invariants on about 300 valid strings", () => {
    const random = seededRandom(20261019);
    let checked = 0;
    for (let attempt = 0; attempt < 20000 && checked < 300; attempt += 1) {
      const input = randomHtml(random);
      if (!sanitizeTelegramHtml(input).ok) continue;
      checked += 1;
      expectInvariants(input);
    }
    expect(checked).toBe(300);
  });
});
