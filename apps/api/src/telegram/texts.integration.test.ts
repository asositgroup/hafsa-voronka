import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { botTexts } from "@/db/schema";
import { setTestEnv } from "@/test/env";

const testDbUrl = process.env.TEST_DATABASE_URL;
const PASSWORD = "bot-texts-admin-password";
const LEADS_CHAT_ID = "-1001234567890";
const LEADS_THREAD_ID = 7;

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!testDbUrl)("Editable bot texts", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let texts: typeof import("./texts");
  let api: ReturnType<typeof import("./bot").bot>["api"];
  let cookie: string;
  const calls: ApiCall[] = [];

  beforeAll(async () => {
    setTestEnv({
      DATABASE_URL: testDbUrl!,
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
      SESSION_SECRET: "bot-texts-session-secret-0123456789abcdef",
      LEADS_CHAT_ID,
      LEADS_THREAD_ID: String(LEADS_THREAD_ID),
    });
    await runMigrations(testDbUrl!);
    texts = await import("./texts");
    api = (await import("./bot")).bot().api;
    api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      if (method === "sendPhoto") {
        return { ok: true, result: { message_id: 501, photo: [{ file_id: "photo-small" }, { file_id: "photo-big" }] } } as never;
      }
      if (method === "sendVideo") return { ok: true, result: { message_id: 502, video: { file_id: "video-id" } } } as never;
      return { ok: true, result: true } as never;
    });
    app = (await import("@/app")).createApp();

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    cookie = login.headers.get("set-cookie")!.split(";")[0];
  });

  beforeEach(async () => {
    calls.length = 0;
    await db().delete(botTexts);
    texts.invalidateBotTexts();
  });

  afterAll(async () => {
    await db().delete(botTexts);
    await closeDb();
  });

  const request = (path: string, init: RequestInit = {}) =>
    app.request(`/admin/bot-texts${path}`, { ...init, headers: { cookie, ...init.headers } });

  const putText = (key: string, text: string) =>
    request(`/${key}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });

  const upload = (key: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/${key}/media`, { method: "POST", body: form });
  };

  it("requires an admin session", async () => {
    const res = await app.request("/admin/bot-texts");
    expect(res.status).toBe(401);
  });

  it("lists every editable text with its default", async () => {
    const res = await request("");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mediaEnabled).toBe(true);
    expect(body.items).toHaveLength(12);
    const welcome = body.items.find((item: { key: string }) => item.key === "welcome");
    expect(welcome).toMatchObject({ kind: "message", placeholders: ["name"], text: null, media: null });
    expect(welcome.defaultText).toContain("{name}");
  });

  it("sends the edited message with the name filled in", async () => {
    expect((await putText("welcome", "Xush kelibsiz, {name}!")).status).toBe(200);

    await texts.sendBotText(api, 42, "welcome", { name: "Aziza" });
    expect(calls).toEqual([
      { method: "sendMessage", payload: expect.objectContaining({ chat_id: 42, text: "Xush kelibsiz, Aziza!", parse_mode: "HTML" }) },
    ]);
  });

  it("sends formatting as Telegram HTML and escapes the substituted name", async () => {
    expect((await putText("welcome", "<b>Salom</b>, {name}!")).status).toBe(200);

    await texts.sendBotText(api, 42, "welcome", { name: "A<i>&Z" });
    expect(calls[0]).toMatchObject({
      method: "sendMessage",
      payload: { text: "<b>Salom</b>, A&lt;i&gt;&amp;Z!", parse_mode: "HTML" },
    });
  });

  it("sends a caption as HTML when media is attached", async () => {
    await putText("welcome", "<i>Salom</i> {name}");
    await upload("welcome", new File([new Uint8Array([1])], "a.png", { type: "image/png" }));
    calls.length = 0;
    await texts.sendBotText(api, 42, "welcome", { name: "Ali" });
    expect(calls[0]).toMatchObject({ method: "sendPhoto", payload: { caption: "<i>Salom</i> Ali", parse_mode: "HTML" } });
  });

  it("rejects badly nested formatting for messages but stores buttons as plain text", async () => {
    expect(await (await putText("welcome", "<b><code>x</code></b>")).json()).toEqual({ error: "invalid_nesting" });
    expect(await (await putText("welcome", "<b>Salom")).json()).toEqual({ error: "unbalanced_tag" });
    expect((await putText("watchButton", "A <b> B")).status).toBe(200);
    expect(await texts.botText("watchButton")).toBe("A <b> B");
  });

  it("treats a legacy text with literal angle brackets as escaped after migration", async () => {
    expect((await putText("fallback", "1 &lt; 2 &amp; 3")).status).toBe(200);
    await texts.sendBotText(api, 1, "fallback");
    expect(calls[0].payload).toMatchObject({ text: "1 &lt; 2 &amp; 3" });
  });

  it("rejects invalid text and keeps the previous value", async () => {
    expect(await (await putText("registered", "Rahmat, {name}")).json()).toEqual({ error: "unknown_placeholder" });
    expect(await (await putText("watchButton", "Ko'rish\nhozir")).json()).toEqual({ error: "multiline_button" });
    expect((await putText("watchButton", "")).status).toBe(422);
    expect(await texts.botText("watchButton")).toBe(texts.defaultBotTexts.watchButton);
  });

  it("uses edited button labels", async () => {
    await putText("watchButton", "Darsni ochish");
    expect(await texts.botText("watchButton")).toBe("Darsni ochish");
  });

  it("uploads a photo through the leads topic, removes it there, and sends it with the caption", async () => {
    const res = await upload("welcome", new File([new Uint8Array([1, 2, 3])], "welcome.png", { type: "image/png" }));
    expect(res.status).toBe(200);
    expect(calls.map((call) => call.method)).toEqual(["sendPhoto", "deleteMessage"]);
    expect(calls[0].payload).toMatchObject({
      chat_id: LEADS_CHAT_ID,
      message_thread_id: LEADS_THREAD_ID,
      disable_notification: true,
    });
    expect(calls[1].payload).toMatchObject({ chat_id: LEADS_CHAT_ID, message_id: 501 });

    calls.length = 0;
    await texts.sendBotText(api, 42, "welcome", { name: "Aziza" }, { remove_keyboard: true });
    expect(calls).toEqual([
      {
        method: "sendPhoto",
        payload: expect.objectContaining({
          chat_id: 42,
          photo: "photo-big",
          caption: texts.defaultBotTexts.welcome.replace("{name}", "Aziza"),
          reply_markup: { remove_keyboard: true },
        }),
      },
    ]);
  });

  it("sends videos as streamable video", async () => {
    await upload("completion", new File([new Uint8Array([1])], "outro.mp4", { type: "video/mp4" }));
    calls.length = 0;
    await texts.sendBotText(api, 7, "completion");
    expect(calls[0]).toMatchObject({ method: "sendVideo", payload: { video: "video-id", supports_streaming: true } });
  });

  it("rejects unsupported files and media on buttons", async () => {
    expect((await upload("welcome", new File(["x"], "a.gif", { type: "image/gif" }))).status).toBe(415);
    expect((await upload("watchButton", new File(["x"], "a.png", { type: "image/png" }))).status).toBe(404);
  });

  it("rejects a caption longer than Telegram allows once media is attached", async () => {
    await putText("welcome", "a".repeat(2000));
    const res = await upload("welcome", new File(["x"], "a.png", { type: "image/png" }));
    expect(await res.json()).toEqual({ error: "caption_too_long" });
  });

  it("removes media and resets to the default text", async () => {
    await putText("welcome", "Yangi matn {name}");
    await upload("welcome", new File(["x"], "a.png", { type: "image/png" }));

    await request("/welcome/media", { method: "DELETE" });
    calls.length = 0;
    await texts.sendBotText(api, 1, "welcome", { name: "Ali" });
    expect(calls[0]).toMatchObject({ method: "sendMessage", payload: { text: "Yangi matn Ali" } });

    await request("/welcome", { method: "DELETE" });
    expect(await texts.botText("welcome", { name: "Ali" })).toBe(texts.defaultBotTexts.welcome.replace("{name}", "Ali"));
  });
});
