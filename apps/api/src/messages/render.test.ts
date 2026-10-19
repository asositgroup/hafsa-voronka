import { beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_CONTEXT, type TemplateButton } from "@funnel/shared";
import { setTestEnv } from "@/test/env";

type RenderModule = typeof import("./render");

describe("renderTemplate", () => {
  let renderTemplate: RenderModule["renderTemplate"];

  beforeAll(async () => {
    setTestEnv({ CHANNEL_URL: "https://t.me/hafsa_admin" });
    renderTemplate = (await import("./render")).renderTemplate;
  });

  const render = (buttons: TemplateButton[], opts: Parameters<RenderModule["renderTemplate"]>[2] = { ref: "s42" }) =>
    renderTemplate({ text: "Salom, <b>{ism}</b>! {qolgan_vaqt}", media: null, buttons }, SAMPLE_CONTEXT, opts);

  it("fills the variables and uses HTML parse mode", () => {
    const rendered = render([]);
    expect(rendered.text).toBe("Salom, <b>Aziza</b>! 2 kun 5 soat");
    expect(rendered.parse_mode).toBe("HTML");
    expect(rendered.reply_markup).toBeUndefined();
  });

  it("sends the canonical HTML instead of the raw stored text", () => {
    const rendered = renderTemplate(
      { text: "1 < 2 <strong>{ism}</strong>", media: null, buttons: [] },
      SAMPLE_CONTEXT,
      { ref: "s1" },
    );
    expect(rendered.text).toBe("1 &lt; 2 <b>Aziza</b>");
  });

  it("builds one button per row with the right button types", () => {
    const rendered = render([
      { kind: "resume", text: "Ha, ko'raman" },
      { kind: "offer", text: "Taklif" },
      { kind: "admin", text: "Yozish", prefill: "Salom, men {ism}" },
      { kind: "link", text: "Ochish", url: "https://x.uz/a" },
      { kind: "again", text: "Ha, ko'raman" },
      { kind: "later", text: "Keyinroq" },
    ]);
    expect(rendered.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Ha, ko'raman", web_app: { url: "https://example.com/app?start=resume" } }],
      [{ text: "Taklif", web_app: { url: "https://example.com/app?start=offer" } }],
      [{ text: "Yozish", url: "https://t.me/hafsa_admin?text=Salom%2C+men+Aziza" }],
      [{ text: "Ochish", url: "https://x.uz/a" }],
      [{ text: "Ha, ko'raman", web_app: { url: "https://example.com/app?start=again" } }],
      [{ text: "Keyinroq", callback_data: "mt:l:s42" }],
    ]);
  });

  it("keeps callback data within Telegram's limit", () => {
    const rendered = render([{ kind: "later", text: "Q" }], { ref: "s9223372036854775807" });
    const data = (rendered.reply_markup?.inline_keyboard[0][0] as { callback_data: string }).callback_data;
    expect(new TextEncoder().encode(data).length).toBeLessThan(64);
    expect(data).toBe("mt:l:s9223372036854775807");
  });

  it("wraps url and web app buttons only when asked", () => {
    const rendered = render(
      [
        { kind: "resume", text: "Ko'rish" },
        { kind: "link", text: "Ochish", url: "https://x.uz/a" },
        { kind: "later", text: "Keyinroq" },
      ],
      {
        ref: "s1",
        wrap: {
          url: (url, index) => `https://api.example.com/r/1?i=${index}&to=${encodeURIComponent(url)}`,
          webApp: (url, index) => `${url}&m=${index}`,
        },
      },
    );
    expect(rendered.reply_markup?.inline_keyboard).toEqual([
      [{ text: "Ko'rish", web_app: { url: "https://example.com/app?start=resume&m=0" } }],
      [{ text: "Ochish", url: "https://api.example.com/r/1?i=1&to=https%3A%2F%2Fx.uz%2Fa" }],
      [{ text: "Keyinroq", callback_data: "mt:l:s1" }],
    ]);
  });
});
