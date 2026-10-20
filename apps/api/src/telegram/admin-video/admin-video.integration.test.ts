import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import type { Bot } from "grammy";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { botAdminInputs, botVideoDrafts, users, videos } from "@/db/schema";
import { setR2ForTests, type R2Store } from "@/storage/r2";
import { setTestEnv } from "@/test/env";
import { createTestVideo, ensureActiveTestVideo } from "@/test/videos";

const serverDbUrl = process.env.TEST_DATABASE_URL;
const isolatedDbName = `vf_admin_video_${process.pid}`;
const testDbUrl = serverDbUrl && Object.assign(new URL(serverDbUrl), { pathname: `/${isolatedDbName}` }).toString();
const PUBLIC_BASE = "https://video.example.com";
const FLOW_ADMIN = 900;
const REGULAR_USER = 901;
const RETRY_ADMIN = 902;
const DOUBLE_TAP_ADMIN = 903;
const LIBRARY_ADMIN = 904;
const SKIP_ADMIN = 905;
const SHORT_ADMIN = 906;
const BACK_ADMIN = 907;
const ADMIN_IDS = [FLOW_ADMIN, RETRY_ADMIN, DOUBLE_TAP_ADMIN, LIBRARY_ADMIN, SKIP_ADMIN, SHORT_ADMIN, BACK_ADMIN];

type ApiCall = { method: string; payload: Record<string, unknown> };

describe.skipIf(!testDbUrl)("Admin video flow in Telegram", () => {
  let testBot: Bot;
  let awaitUploads: () => Promise<void>;
  let workDir: string;
  let originalActiveId: number;
  let updateId = 1;
  let messageCounter = 1000;
  const calls: ApiCall[] = [];
  const createdKeys: string[] = [];
  const uploadedBytes = new Map<string, number>();
  const localFiles = new Map<string, string>();

  const store: R2Store = {
    createMultipart: vi.fn(async (key: string) => {
      createdKeys.push(key);
      return `upload-${createdKeys.length}`;
    }),
    presignPart: vi.fn(async () => "https://signed.example.com/part"),
    uploadPart: vi.fn(async (key: string, _id: string, _number: number, body: Uint8Array) => {
      uploadedBytes.set(key, (uploadedBytes.get(key) ?? 0) + body.byteLength);
      return "etag";
    }),
    completeMultipart: vi.fn(async () => {}),
    abortMultipart: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
    publicUrl: (key) => `${PUBLIC_BASE}/${key}`,
  };

  beforeAll(async () => {
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName}`);
    await admin.unsafe(`create database ${isolatedDbName}`);
    await admin.end();
    setTestEnv({
      DATABASE_URL: testDbUrl!,
      ADMIN_TELEGRAM_IDS: ADMIN_IDS.join(","),
      R2_ACCOUNT_ID: "acc",
      R2_BUCKET: "funnel-video",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE_URL: PUBLIC_BASE,
    });
    await runMigrations(testDbUrl!);
    originalActiveId = (await ensureActiveTestVideo()).id;
    setR2ForTests(store);
    workDir = await mkdtemp(join(tmpdir(), "vf-admin-video-"));

    awaitUploads = (await import("./upload")).awaitUploads;
    const { bot } = await import("../bot");
    testBot = bot();
    testBot.botInfo = {
      id: 1,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as Bot["botInfo"];
    testBot.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as Record<string, unknown> });
      if (method === "getFile") {
        const fileId = (payload as { file_id: string }).file_id;
        return { ok: true, result: { file_id: fileId, file_path: localFiles.get(fileId) } } as never;
      }
      if (method === "sendMessage") {
        return { ok: true, result: { message_id: messageCounter++ } } as never;
      }
      return { ok: true, result: true } as never;
    });
  });

  beforeEach(() => {
    calls.length = 0;
  });

  afterAll(async () => {
    setR2ForTests(null);
    await closeDb();
    await rm(workDir, { recursive: true, force: true });
    const admin = postgres(serverDbUrl!, { max: 1 });
    await admin.unsafe(`drop database if exists ${isolatedDbName} with (force)`);
    await admin.end();
  });

  function from(id: number) {
    return { id, is_bot: false, first_name: "Admin" };
  }

  function chat(id: number) {
    return { id, type: "private", first_name: "Admin" };
  }

  function message(id: number, fields: Record<string, unknown>) {
    return testBot.handleUpdate({
      update_id: updateId++,
      message: {
        message_id: updateId,
        date: Math.floor(Date.now() / 1000),
        chat: chat(id),
        from: from(id),
        ...fields,
      },
    } as never);
  }

  function tap(id: number, data: string) {
    return testBot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId),
        from: from(id),
        chat_instance: "1",
        data,
        message: { message_id: 5, date: Math.floor(Date.now() / 1000), chat: chat(id) },
      },
    } as never);
  }

  async function stageFile(uniqueId: string) {
    const fileId = `file-${uniqueId}`;
    const path = join(workDir, `${uniqueId}.mp4`);
    await writeFile(path, Buffer.alloc(2048, 1));
    localFiles.set(fileId, path);
    return fileId;
  }

  async function sendDocument(adminId: number, uniqueId: string) {
    const fileId = await stageFile(uniqueId);
    await message(adminId, {
      document: {
        file_id: fileId,
        file_unique_id: uniqueId,
        file_size: 2048,
        mime_type: "video/mp4",
        file_name: `${uniqueId}.mp4`,
      },
    });
  }

  function command(adminId: number, text: string) {
    return message(adminId, { text, entities: [{ type: "bot_command", offset: 0, length: text.length }] });
  }

  async function sendVideo(adminId: number, uniqueId: string, extra: Record<string, unknown> = {}, duration = 600) {
    const fileId = await stageFile(uniqueId);
    await message(adminId, {
      video: {
        file_id: fileId,
        file_unique_id: uniqueId,
        width: 1280,
        height: 720,
        duration,
        file_size: 2048,
        mime_type: "video/mp4",
        file_name: `${uniqueId}.mp4`,
      },
      caption: " Bot darsi ",
      ...extra,
    });
  }

  const sent = () => calls.filter((call) => call.method === "sendMessage");
  const edits = () => calls.filter((call) => call.method === "editMessageText");
  const answers = () => calls.filter((call) => call.method === "answerCallbackQuery");

  function buttons(call: ApiCall | undefined) {
    const markup = call?.payload.reply_markup as { inline_keyboard?: { text: string; callback_data: string }[][] } | undefined;
    return markup?.inline_keyboard?.flat() ?? [];
  }

  function lastButton(prefix: string) {
    for (const call of [...sent()].reverse()) {
      const found = buttons(call).find((button) => button.callback_data.startsWith(prefix));
      if (found) return found.callback_data;
    }
    throw new Error(`No ${prefix} button was sent`);
  }

  async function draftOf(uniqueId: string) {
    const rows = await db().select().from(botVideoDrafts).where(eq(botVideoDrafts.fileUniqueId, uniqueId));
    return rows[0];
  }

  it("replaces the active video from Telegram and keeps existing users on theirs", async () => {
    const [existingUser] = await db()
      .insert(users)
      .values({ telegramId: 8_000_000 + Math.floor(Math.random() * 100_000), videoId: originalActiveId })
      .returning();
    const uniqueId = `flow-${Date.now()}`;

    await sendVideo(FLOW_ADMIN, uniqueId);
    expect(buttons(sent()[0]).map((button) => button.text)).toEqual(["Ha", "Yo'q"]);

    await tap(FLOW_ADMIN, lastButton("vup:yes:"));
    expect(String(sent().at(-1)?.payload.text)).toContain("MM:SS");

    await tap(FLOW_ADMIN, lastButton("vup:skip:"));
    await message(FLOW_ADMIN, { text: "02:00" });
    await message(FLOW_ADMIN, { text: "05:00" });
    await tap(FLOW_ADMIN, lastButton("vup:skip:"));
    expect(buttons(sent().at(-1)).map((button) => button.text)).toEqual(["Faol qilish", "⬅️ Orqaga"]);
    expect(String(sent().at(-1)?.payload.text)).toContain("⏭ Asosiy dars: 01:59 (avtomatik)");

    await tap(FLOW_ADMIN, lastButton("vup:act:"));
    await awaitUploads();

    const draft = await draftOf(uniqueId);
    expect(draft).toMatchObject({ step: "done", uploadStatus: "done" });
    expect(uploadedBytes.get(`videos/bot/${uniqueId}.mp4`)).toBe(2048);

    const [created] = await db().select().from(videos).where(eq(videos.id, draft.videoId!));
    expect(created).toMatchObject({
      title: "Bot darsi",
      duration: 600,
      introEndSec: 119,
      courseStartSec: 120,
      priceSec: 300,
      isActive: true,
      fileUrl: `${PUBLIC_BASE}/videos/bot/${uniqueId}.mp4`,
    });
    const [previous] = await db().select().from(videos).where(eq(videos.id, originalActiveId));
    expect(previous.isActive).toBe(false);
    const [user] = await db().select().from(users).where(eq(users.id, existingUser.id));
    expect(user.videoId).toBe(originalActiveId);
    expect(sent().at(-1)?.payload.text).toBe(`Faol qilindi ✅ #${created.id}`);
  });

  it("does not let a regular user start a draft", async () => {
    await sendVideo(REGULAR_USER, `regular-${Date.now()}`);

    expect(sent()).toHaveLength(1);
    expect(JSON.stringify(sent()[0].payload)).not.toContain("vup:");
    const rows = await db().select().from(botVideoDrafts).where(eq(botVideoDrafts.adminTelegramId, REGULAR_USER));
    expect(rows).toHaveLength(0);
  });

  it("keeps one draft and one upload when the same video is sent twice", async () => {
    const uniqueId = `retry-${Date.now()}`;
    await sendVideo(RETRY_ADMIN, uniqueId);
    await tap(RETRY_ADMIN, lastButton("vup:yes:"));
    await sendVideo(RETRY_ADMIN, uniqueId);
    await tap(RETRY_ADMIN, lastButton("vup:yes:"));
    await awaitUploads();

    const rows = await db().select().from(botVideoDrafts).where(eq(botVideoDrafts.fileUniqueId, uniqueId));
    expect(rows).toHaveLength(1);
    expect(createdKeys.filter((key) => key === `videos/bot/${uniqueId}.mp4`)).toHaveLength(1);
  });

  it("creates one video when Faol qilish is tapped twice", async () => {
    const uniqueId = `double-${Date.now()}`;
    await sendVideo(DOUBLE_TAP_ADMIN, uniqueId);
    await tap(DOUBLE_TAP_ADMIN, lastButton("vup:yes:"));
    await message(DOUBLE_TAP_ADMIN, { text: "00:30" });
    await message(DOUBLE_TAP_ADMIN, { text: "01:00" });
    await message(DOUBLE_TAP_ADMIN, { text: "02:00" });
    await message(DOUBLE_TAP_ADMIN, { text: "08:00" });
    await awaitUploads();

    const activate = lastButton("vup:act:");
    await Promise.all([tap(DOUBLE_TAP_ADMIN, activate), tap(DOUBLE_TAP_ADMIN, activate)]);
    await awaitUploads();

    const fileUrl = `${PUBLIC_BASE}/videos/bot/${uniqueId}.mp4`;
    expect(await db().select().from(videos).where(eq(videos.fileUrl, fileUrl))).toHaveLength(1);
    expect((await draftOf(uniqueId)).step).toBe("done");
    expect(sent().filter((call) => String(call.payload.text).startsWith("Faol qilindi"))).toHaveLength(1);
  });

  async function videoRow(id: number) {
    const [row] = await db().select().from(videos).where(eq(videos.id, id));
    return row;
  }

  async function inputOf(adminId: number) {
    const [row] = await db().select().from(botAdminInputs).where(eq(botAdminInputs.adminTelegramId, adminId));
    return row;
  }

  function lastEdit() {
    return edits().at(-1);
  }

  function editButtons() {
    return buttons(lastEdit()).map((button) => button.callback_data);
  }

  it("asks the optional marks with a skip button and stores the typed ones", async () => {
    const uniqueId = `skip-${Date.now()}`;
    await sendVideo(SKIP_ADMIN, uniqueId);
    await tap(SKIP_ADMIN, lastButton("vup:yes:"));
    expect(String(sent().at(-1)?.payload.text)).toContain("Send as file");

    expect(buttons(sent().at(-1)).map((button) => button.text)).toEqual(["O'tkazib yuborish"]);

    await message(SKIP_ADMIN, { text: "01:00" });
    await message(SKIP_ADMIN, { text: "00:30" });
    const error = String(sent().at(-1)?.payload.text);
    expect(error).toContain(
      "00:30 bo'lmaydi: kurs qismi asosiy darsdan (01:00) keyin va video oxiridan (10:00) oldin bo'lishi kerak. 01:01 – 09:59 oralig'ida yozing.",
    );
    expect(error).toContain("✅ Asosiy dars: 01:00\n👉 Kurs qismi: ?");
    expect(buttons(sent().at(-1)).map((button) => button.text)).toEqual(["⬅️ Orqaga"]);

    await message(SKIP_ADMIN, { text: "02:00" });
    await message(SKIP_ADMIN, { text: "05:00" });
    await message(SKIP_ADMIN, { text: "07:00" });
    expect(String(sent().at(-1)?.payload.text)).toContain("Tugma ochilishi: 07:00");

    await tap(SKIP_ADMIN, lastButton("vup:act:"));
    await awaitUploads();
    const draft = await draftOf(uniqueId);
    expect(await videoRow(draft.videoId!)).toMatchObject({ introEndSec: 60, unlockSec: 420, isActive: true });
  });

  it("asks the marks in order with a checklist, range errors and a back button", async () => {
    const uniqueId = `back-${Date.now()}`;
    await sendVideo(BACK_ADMIN, uniqueId, {}, 40);
    await tap(BACK_ADMIN, lastButton("vup:yes:"));
    const first = String(sent().at(-1)?.payload.text);
    expect(first).toContain(
      "🎬 Video: 00:40\n👉 Asosiy dars: ?\n▫️ Kurs qismi\n▫️ Narx\n▫️ Tugma ochilishi\n\nAsosiy dars nechanchi daqiqada boshlanadi?",
    );
    expect(first).toContain("Oraliq: 00:00 – 00:39");

    await message(BACK_ADMIN, { text: "00:05" });
    expect(String(sent().at(-1)?.payload.text)).toContain("Oraliq: 00:06 – 00:39");
    await message(BACK_ADMIN, { text: "00:05" });
    expect(String(sent().at(-1)?.payload.text)).toContain(
      "⚠️ 00:05 bo'lmaydi: kurs qismi asosiy darsdan (00:05) keyin va video oxiridan (00:40) oldin bo'lishi kerak. 00:06 – 00:39 oralig'ida yozing.",
    );
    await message(BACK_ADMIN, { text: "5 daqiqa" });
    expect(String(sent().at(-1)?.payload.text)).toContain("Vaqtni MM:SS ko'rinishida yozing, masalan 05:00");

    await message(BACK_ADMIN, { text: "00:20" });
    await message(BACK_ADMIN, { text: "00:22" });
    expect(String(sent().at(-1)?.payload.text)).toContain("✅ Narx: 00:22\n👉 Tugma ochilishi: ?");

    await tap(BACK_ADMIN, lastButton("vup:back:"));
    expect((await draftOf(uniqueId)).step).toBe("price");
    expect(buttons(sent().at(-1)).map((button) => button.text)).toEqual(["✅ 00:22 qolsin", "⬅️ Orqaga"]);
    await tap(BACK_ADMIN, lastButton("vup:back:"));
    expect(String(sent().at(-1)?.payload.text)).toContain("👉 Kurs qismi: 00:20\n▫️ Narx: 00:22");

    await message(BACK_ADMIN, { text: "00:39" });
    const noRoom = String(sent().at(-1)?.payload.text);
    expect(noRoom).toContain("Narx uchun joy qolmadi");
    expect(noRoom).toContain("«⬅️ Orqaga»");
    await message(BACK_ADMIN, { text: "00:39" });
    expect(String(sent().at(-1)?.payload.text)).toContain("⚠️ Narx uchun joy qolmadi");

    await tap(BACK_ADMIN, lastButton("vup:back:"));
    await message(BACK_ADMIN, { text: "00:21" });
    await tap(BACK_ADMIN, lastButton("vup:keep:"));
    await tap(BACK_ADMIN, lastButton("vup:skip:"));
    const summary = String(sent().at(-1)?.payload.text);
    expect(summary).toContain(
      "✅ Asosiy dars: 00:05\n✅ Kurs qismi: 00:21\n✅ Narx: 00:22\n⏭ Tugma ochilishi: darhol",
    );
    expect(await draftOf(uniqueId)).toMatchObject({ step: "summary", introEndSec: 5, courseStartSec: 21, priceSec: 22 });

    await message(BACK_ADMIN, { text: "/bekor", entities: [{ type: "bot_command", offset: 0, length: 6 }] });
    await awaitUploads();
  });

  it("does not suggest sending as a file when the video already came as a document", async () => {
    const uniqueId = `doc-${Date.now()}`;
    await sendDocument(SKIP_ADMIN, uniqueId);
    await tap(SKIP_ADMIN, lastButton("vup:yes:"));
    expect(String(sent().at(-1)?.payload.text)).not.toContain("Send as file");
    await message(SKIP_ADMIN, { text: "/bekor", entities: [{ type: "bot_command", offset: 0, length: 6 }] });
    await awaitUploads();
  });

  it("ignores /videolar from a regular user", async () => {
    await command(REGULAR_USER, "/videolar");

    expect(sent()).toHaveLength(1);
    expect(JSON.stringify(sent()[0].payload)).not.toContain("vl:");
  });

  it("lists videos with the active one first and opens a detail card", async () => {
    const extra = await createTestVideo({ title: "Ro'yxat darsi", priceSec: 300 });
    await command(LIBRARY_ADMIN, "/videolar");

    const list = buttons(sent().at(-1));
    const [active] = await db().select().from(videos).where(eq(videos.isActive, true));
    expect(list[0]).toMatchObject({ callback_data: `vl:show:${active.id}` });
    expect(list[0].text.startsWith("✅")).toBe(true);
    expect(list.some((button) => button.callback_data === `vl:show:${extra.id}`)).toBe(true);

    await tap(LIBRARY_ADMIN, `vl:show:${extra.id}`);
    expect(String(lastEdit()?.payload.text)).toContain("Ro'yxat darsi");
    expect(String(lastEdit()?.payload.text)).toContain("Narx: 05:00");
    expect(editButtons()).toEqual([
      `vl:act:${extra.id}`,
      `vl:marks:${extra.id}`,
      `vl:short:${extra.id}`,
      `vl:arch:${extra.id}`,
      `vl:del:${extra.id}`,
      "vl:list:0",
    ]);

    await tap(LIBRARY_ADMIN, `vl:show:${active.id}`);
    expect(editButtons()).toEqual([`vl:marks:${active.id}`, `vl:short:${active.id}`, "vl:list:0"]);
  });

  it("activates a video from the card", async () => {
    const video = await createTestVideo({ title: "Yangi faol", courseStartSec: 60, priceSec: 300 });
    await tap(LIBRARY_ADMIN, `vl:act:${video.id}`);

    expect((await videoRow(video.id)).isActive).toBe(true);
    expect(answers().at(-1)?.payload.text).toBe("Faol qilindi ✅");
    expect(String(lastEdit()?.payload.text)).toContain("faol ✅");
  });

  it("refuses to activate a video without a price mark", async () => {
    const video = await createTestVideo({ title: "Narxsiz" });
    await tap(LIBRARY_ADMIN, `vl:act:${video.id}`);

    expect((await videoRow(video.id)).isActive).toBe(false);
    expect(answers().at(-1)?.payload).toMatchObject({ show_alert: true });
    expect(String(answers().at(-1)?.payload.text)).toContain("«Narx»");
  });

  it("archives and unarchives a video", async () => {
    const video = await createTestVideo({ title: "Arxiv uchun" });
    await tap(LIBRARY_ADMIN, `vl:arch:${video.id}`);
    expect((await videoRow(video.id)).archivedAt).not.toBeNull();
    expect(editButtons()).toContain(`vl:unarch:${video.id}`);
    expect(editButtons()).not.toContain(`vl:act:${video.id}`);

    await tap(LIBRARY_ADMIN, `vl:unarch:${video.id}`);
    expect((await videoRow(video.id)).archivedAt).toBeNull();
  });

  it("refuses to archive the active video", async () => {
    const [active] = await db().select().from(videos).where(eq(videos.isActive, true));
    await tap(LIBRARY_ADMIN, `vl:arch:${active.id}`);
    expect((await videoRow(active.id)).archivedAt).toBeNull();
    expect(answers().at(-1)?.payload).toMatchObject({ show_alert: true });
  });

  it("deletes a video only after confirmation", async () => {
    const video = await createTestVideo({ title: "O'chiriladigan", fileUrl: `${PUBLIC_BASE}/videos/delete-me.mp4` });
    await tap(LIBRARY_ADMIN, `vl:del:${video.id}`);
    expect(await videoRow(video.id)).toBeDefined();
    expect(editButtons()).toEqual([`vl:delyes:${video.id}`, `vl:show:${video.id}`]);

    await tap(LIBRARY_ADMIN, `vl:delyes:${video.id}`);
    expect(await videoRow(video.id)).toBeUndefined();
    expect(store.deleteObject).toHaveBeenCalledWith("videos/delete-me.mp4");
    expect(String(lastEdit()?.payload.text)).toContain("O'chirildi");
  });

  it("refuses to delete a video that users are pinned to", async () => {
    const video = await createTestVideo({ title: "Band" });
    await db().insert(users).values({ telegramId: 8_100_000 + Math.floor(Math.random() * 100_000), videoId: video.id });
    await tap(LIBRARY_ADMIN, `vl:delyes:${video.id}`);
    expect(await videoRow(video.id)).toBeDefined();
    expect(String(answers().at(-1)?.payload.text)).toContain("1 ta foydalanuvchi");
  });

  it("edits a mark with the shared validation rules", async () => {
    const video = await createTestVideo({ title: "Belgilar", courseStartSec: 120, priceSec: 300 });
    await tap(LIBRARY_ADMIN, `vl:marks:${video.id}`);
    expect(editButtons()).toContain(`vl:mark:${video.id}:priceSec`);

    await tap(LIBRARY_ADMIN, `vl:mark:${video.id}:priceSec`);
    expect(await inputOf(LIBRARY_ADMIN)).toMatchObject({ kind: "mark", videoId: video.id, mark: "priceSec" });
    const prompt = String(lastEdit()?.payload.text);
    expect(prompt).toContain(
      "🎬 Video: 15:00\n⏭ Asosiy dars: 01:59 (avtomatik)\n✅ Kurs qismi: 02:00\n👉 Narx: 05:00\n⏭ Tugma ochilishi: darhol",
    );
    expect(prompt).toContain("Oraliq: 02:01 – 14:59");

    await message(LIBRARY_ADMIN, { text: "16:00" });
    expect(String(sent().at(-1)?.payload.text)).toContain(
      "16:00 bo'lmaydi: narx kurs qismidan (02:00) keyin va video oxiridan (15:00) oldin bo'lishi kerak. 02:01 – 14:59 oralig'ida yozing.",
    );
    expect(String(sent().at(-1)?.payload.text)).toContain("👉 Narx: 05:00");
    expect((await videoRow(video.id)).priceSec).toBe(300);

    await message(LIBRARY_ADMIN, { text: "01:00" });
    expect(String(sent().at(-1)?.payload.text)).toContain("01:00 bo'lmaydi: narx kurs qismidan (02:00) keyin");

    await message(LIBRARY_ADMIN, { text: "06:30" });
    expect((await videoRow(video.id)).priceSec).toBe(390);
    expect(await inputOf(LIBRARY_ADMIN)).toBeUndefined();
    expect(String(sent().at(-1)?.payload.text)).toContain("Saqlandi ✅");
  });

  it("clears an optional mark", async () => {
    const video = await createTestVideo({ title: "Tugma", unlockSec: 200 });
    await tap(LIBRARY_ADMIN, `vl:mark:${video.id}:unlockSec`);
    expect(editButtons()).toEqual([`vl:clear:${video.id}`, `vl:cancel:${video.id}`]);

    await tap(LIBRARY_ADMIN, `vl:clear:${video.id}`);
    expect((await videoRow(video.id)).unlockSec).toBeNull();
    expect(await inputOf(LIBRARY_ADMIN)).toBeUndefined();
  });

  it("uploads the short video through the pending state instead of starting a new lesson", async () => {
    const video = await createTestVideo({ title: "Qisqa video uchun" });
    await tap(SHORT_ADMIN, `vl:short:${video.id}`);
    expect(String(lastEdit()?.payload.text)).toContain("Qisqa «Kurs haqida» videosini yuboring");

    const uniqueId = `short-${Date.now()}`;
    await sendVideo(SHORT_ADMIN, uniqueId);
    await awaitUploads();

    expect(await draftOf(uniqueId)).toBeUndefined();
    const key = `videos/bot/${uniqueId}-offer-${video.id}.mp4`;
    expect(uploadedBytes.get(key)).toBe(2048);
    expect(await videoRow(video.id)).toMatchObject({ shortOfferVideoUrl: `${PUBLIC_BASE}/${key}`, shortOfferDuration: 600 });
    expect(await inputOf(SHORT_ADMIN)).toBeUndefined();
    expect(String(sent().at(-1)?.payload.text)).toContain("Qisqa video saqlandi ✅");
    expect(buttons(sent().at(-1)).map((button) => button.callback_data)).toContain(`vl:shortdel:${video.id}`);
  });

  it("asks the duration of a short video sent as a file", async () => {
    const video = await createTestVideo({ title: "Fayl qisqa" });
    await tap(SHORT_ADMIN, `vl:short:${video.id}`);

    const uniqueId = `short-doc-${Date.now()}`;
    await sendDocument(SHORT_ADMIN, uniqueId);
    await awaitUploads();
    expect(sent().some((call) => String(call.payload.text).includes("Qisqa video davomiyligini"))).toBe(true);
    expect((await videoRow(video.id)).shortOfferVideoUrl).toBeNull();

    await message(SHORT_ADMIN, { text: "abc" });
    expect(String(sent().at(-1)?.payload.text)).toContain("Vaqtni MM:SS ko'rinishida yozing");
    await message(SHORT_ADMIN, { text: "01:30" });

    expect(await videoRow(video.id)).toMatchObject({
      shortOfferVideoUrl: `${PUBLIC_BASE}/videos/bot/${uniqueId}-offer-${video.id}.mp4`,
      shortOfferDuration: 90,
    });

    await tap(SHORT_ADMIN, `vl:shortdel:${video.id}`);
    expect(await videoRow(video.id)).toMatchObject({ shortOfferVideoUrl: null, shortOfferDuration: null });
  });
});
