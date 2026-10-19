import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderText,
  sanitizeTelegramHtml,
  templateButtonSchema,
  validateTemplateText,
  visibleLength,
} from "@funnel/shared";

function sanitized(input: string) {
  const result = sanitizeTelegramHtml(input);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("sanitizeTelegramHtml", () => {
  it("keeps the allowed tags", () => {
    expect(sanitized('<b>a</b> <i>b</i> <a href="https://t.me/x">c</a>').html).toBe(
      '<b>a</b> <i>b</i> <a href="https://t.me/x">c</a>',
    );
  });

  it("accepts nested tags", () => {
    expect(sanitized("<b>a <i>b</i></b>").html).toBe("<b>a <i>b</i></b>");
  });

  it("rejects unbalanced or crossed tags", () => {
    expect(sanitizeTelegramHtml("<b>a")).toEqual({ ok: false, error: "unbalanced_tag" });
    expect(sanitizeTelegramHtml("a</b>")).toEqual({ ok: false, error: "unbalanced_tag" });
    expect(sanitizeTelegramHtml("<b><i>a</b></i>")).toEqual({ ok: false, error: "unbalanced_tag" });
  });

  it("rejects links that are not http, https or tg", () => {
    expect(sanitizeTelegramHtml('<a href="javascript:alert(1)">x</a>')).toEqual({ ok: false, error: "invalid_link" });
    expect(sanitizeTelegramHtml('<a href="https://x.uz/{ism}">x</a>')).toEqual({ ok: false, error: "invalid_link" });
    expect(sanitized('<a href="tg://resolve?domain=x">x</a>').ok).toBe(true);
  });

  it("escapes stray angle brackets and ampersands", () => {
    expect(sanitized("1 < 2 & 3 > 2 <p>x</p>").html).toBe("1 &lt; 2 &amp; 3 &gt; 2 &lt;p&gt;x&lt;/p&gt;");
    expect(sanitized("<u>x</u>").html).toBe("<u>x</u>");
    expect(sanitized("a &amp; b &lt;").html).toBe("a &amp; b &lt;");
  });

  it("is idempotent", () => {
    const first = sanitized('<b>a & b</b> <a href="https://x.uz/?a=1&b=2">c < d</a>').html;
    expect(sanitized(first).html).toBe(first);
  });

  it("returns tokens for the preview", () => {
    expect(sanitized("<b>a</b>b").tokens).toEqual([
      { kind: "open", tag: "b" },
      { kind: "text", text: "a" },
      { kind: "close", tag: "b" },
      { kind: "text", text: "b" },
    ]);
  });
});

describe("telegram formatting", () => {
  it("normalises aliases", () => {
    expect(sanitized("<strong>a</strong><em>b</em><ins>c</ins><strike>d</strike><del>e</del>").html).toBe(
      "<b>a</b><i>b</i><u>c</u><s>d</s><s>e</s>",
    );
    expect(sanitized('<span class="tg-spoiler">x</span>').html).toBe("<tg-spoiler>x</tg-spoiler>");
    expect(sanitized("<span class='tg-spoiler'>x</span>").html).toBe("<tg-spoiler>x</tg-spoiler>");
  });

  it("requires closing tags to match the element as written", () => {
    expect(sanitizeTelegramHtml("<strong>x</b>")).toEqual({ ok: false, error: "unbalanced_tag" });
    expect(sanitizeTelegramHtml('<span class="tg-spoiler">x</tg-spoiler>')).toEqual({
      ok: false,
      error: "unbalanced_tag",
    });
  });

  it("handles the pre forms", () => {
    const withLanguage = '<pre><code class="language-python">x</code></pre>';
    expect(sanitized(withLanguage).html).toBe(withLanguage);
    expect(sanitized(withLanguage).tokens[0]).toEqual({ kind: "open", tag: "pre", language: "python" });
    expect(sanitized("<pre><code>x</code></pre>").html).toBe("<pre>x</pre>");
    expect(sanitized('<code class="language-js">x</code>').html).toBe("<code>x</code>");
    expect(sanitizeTelegramHtml('<pre><code class="language-a b">x</code></pre>')).toEqual({
      ok: false,
      error: "invalid_nesting",
    });
  });

  it("handles blockquote", () => {
    expect(sanitized("<blockquote expandable>q</blockquote>").html).toBe("<blockquote expandable>q</blockquote>");
    expect(sanitized('<blockquote expandable="">q</blockquote>').tokens[0]).toEqual({
      kind: "open",
      tag: "blockquote",
      expandable: true,
    });
    expect(sanitizeTelegramHtml("<blockquote><blockquote>q</blockquote></blockquote>")).toEqual({
      ok: false,
      error: "invalid_nesting",
    });
  });

  it("rejects forbidden nesting", () => {
    const link = '<a href="https://x.uz">';
    for (const input of [
      "<code><b>x</b></code>",
      "<b><code>x</code></b>",
      `${link}<code>x</code></a>`,
      `<code>${link}x</a></code>`,
      "<pre><i>x</i></pre>",
      "<tg-spoiler><pre>x</pre></tg-spoiler>",
      "<blockquote><pre>x</pre></blockquote>",
      `${link}${link}x</a></a>`,
      `${link}<blockquote>x</blockquote></a>`,
    ]) {
      expect(sanitizeTelegramHtml(input)).toEqual({ ok: false, error: "invalid_nesting" });
    }
  });

  it("allows valid nesting", () => {
    for (const input of [
      "<b><blockquote>q</blockquote></b>",
      '<blockquote><a href="https://x.uz">l</a> <code>c</code> <b>b</b></blockquote>',
      "<tg-spoiler><b><u>x</u></b></tg-spoiler>",
      '<a href="tg://user?id=123"><b>Ali</b></a>',
      "<code>{ism}</code>",
    ]) {
      expect(sanitized(input).html).toBe(input);
    }
    expect(validateTemplateText("<code>{ism}</code>", false)).toBeNull();
  });

  it("decodes numeric entities", () => {
    expect(sanitized("&#39;").html).toBe("'");
    expect(sanitized("&#x1F600;").html).toBe("\u{1F600}");
    expect(sanitized("&#1114112;").html).toBe("&amp;#1114112;");
    const once = sanitized("&#1114112; &#39; &amp;#39;").html;
    expect(sanitized(once).html).toBe(once);
  });

  it("measures visible length", () => {
    expect(visibleLength('<pre><code class="language-py">ab</code></pre>')).toBe(2);
    expect(visibleLength("<blockquote expandable>a</blockquote>")).toBe(1);
  });

  it("reports nesting errors from validateTemplateText", () => {
    expect(validateTemplateText("<code><b>x</b></code>", false)).toEqual({ error: "invalid_nesting" });
  });
});

describe("renderText", () => {
  it("escapes variable values in code", () => {
    expect(renderText("<code>{ism}</code>", { ism: "<x>" })).toBe("<code>&lt;x&gt;</code>");
  });

  it("escapes variable values", () => {
    expect(renderText("Salom, <b>{ism}</b>", { ism: "A<b>&" })).toBe("Salom, <b>A&lt;b&gt;&amp;</b>");
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });
});

describe("validateTemplateText", () => {
  it("rejects unknown variables", () => {
    expect(validateTemplateText("Salom {familiya}", false)).toEqual({ error: "unknown_variable", variable: "familiya" });
    expect(validateTemplateText("Salom {ism}", false)).toBeNull();
  });

  it("rejects empty text", () => {
    expect(validateTemplateText("  ", false)).toEqual({ error: "empty" });
  });

  it("counts variables at their maximum length", () => {
    expect(visibleLength("{ism}")).toBe(64);
    expect(visibleLength("<b>a&amp;b</b>")).toBe(3);
    expect(validateTemplateText("{ism}".repeat(17), false)).toBeNull();
    expect(validateTemplateText("{ism}".repeat(17), true)).toEqual({ error: "too_long" });
  });

  it("limits a caption to 1024 characters", () => {
    expect(validateTemplateText("a".repeat(1024), true)).toBeNull();
    expect(validateTemplateText("a".repeat(1025), true)).toEqual({ error: "too_long" });
    expect(validateTemplateText("a".repeat(1025), false)).toBeNull();
  });

  it("reports markup errors", () => {
    expect(validateTemplateText("<b>a", false)).toEqual({ error: "unbalanced_tag" });
    expect(validateTemplateText('<a href="ftp://x">a</a>', false)).toEqual({ error: "invalid_link" });
  });
});

describe("templateButtonSchema", () => {
  it("accepts the preset kinds", () => {
    expect(templateButtonSchema.safeParse({ kind: "resume", text: "Ha, ko'raman" }).success).toBe(true);
    expect(templateButtonSchema.safeParse({ kind: "admin", text: "Yozish", prefill: "Salom {ism}" }).success).toBe(true);
  });

  it("limits the label", () => {
    expect(templateButtonSchema.safeParse({ kind: "later", text: "" }).success).toBe(false);
    expect(templateButtonSchema.safeParse({ kind: "later", text: "a".repeat(65) }).success).toBe(false);
    expect(templateButtonSchema.safeParse({ kind: "later", text: "a\nb" }).success).toBe(false);
    expect(templateButtonSchema.safeParse({ kind: "later", text: "{ism}" }).success).toBe(false);
  });

  it("requires an https link", () => {
    expect(templateButtonSchema.safeParse({ kind: "link", text: "Ochish", url: "https://x.uz" }).success).toBe(true);
    expect(templateButtonSchema.safeParse({ kind: "link", text: "Ochish", url: "http://x.uz" }).success).toBe(false);
    expect(templateButtonSchema.safeParse({ kind: "link", text: "Ochish", url: "javascript:1" }).success).toBe(false);
  });
});
