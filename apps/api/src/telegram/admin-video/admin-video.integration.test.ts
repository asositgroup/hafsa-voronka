import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import type { Bot } from "grammy";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { botVideoDrafts, users, videos } from "@/db/schema";
import { setR2ForTests, type R2Store } from "@/storage/r2";
import { setTestEnv } from "@/test/env";
import { ensureActiveTestVideo } from "@/test/videos";

const serverDbUrl = process.env.TEST_DATABASE_URL;
const isolatedDbName = `vf_admin_video_${process.pid}`;
const testDbUrl = serverDbUrl && Object.assign(new URL(serverDbUrl), { pathname: `/${isolatedDbName}` }).toString();
const PUBLIC_BASE = "https://video.example.com";
const FLOW_ADMIN = 900;
const REGULAR_USER = 901;
const RETRY_ADMIN = 902;
const DOUBLE_TAP_ADMIN = 903;
const ADMIN_IDS = [FLOW_ADMIN, RETRY_ADMIN, DOUBLE_TAP_ADMIN];

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

  async function sendVideo(adminId: number, uniqueId: string, extra: Record<string, unknown> = {}) {
    const fileId = `file-${uniqueId}`;
    const path = join(workDir, `${uniqueId}.mp4`);
    await writeFile(path, Buffer.alloc(2048, 1));
    localFiles.set(fileId, path);
    await message(adminId, {
      video: {
        file_id: fileId,
        file_unique_id: uniqueId,
        width: 1280,
        height: 720,
        duration: 600,
        file_size: 2048,
        mime_type: "video/mp4",
        file_name: `${uniqueId}.mp4`,
      },
      caption: " Bot darsi ",
      ...extra,
    });
  }

  const sent = () => calls.filter((call) => call.method === "sendMessage");

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

    await message(FLOW_ADMIN, { text: "02:00" });
    await message(FLOW_ADMIN, { text: "05:00" });
    expect(buttons(sent().at(-1)).map((button) => button.text)).toEqual(["Faol qilish"]);

    await tap(FLOW_ADMIN, lastButton("vup:act:"));
    await awaitUploads();

    const draft = await draftOf(uniqueId);
    expect(draft).toMatchObject({ step: "done", uploadStatus: "done" });
    expect(uploadedBytes.get(`videos/bot/${uniqueId}.mp4`)).toBe(2048);

    const [created] = await db().select().from(videos).where(eq(videos.id, draft.videoId!));
    expect(created).toMatchObject({
      title: "Bot darsi",
      duration: 600,
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
    await message(DOUBLE_TAP_ADMIN, { text: "01:00" });
    await message(DOUBLE_TAP_ADMIN, { text: "02:00" });
    await awaitUploads();

    const activate = lastButton("vup:act:");
    await Promise.all([tap(DOUBLE_TAP_ADMIN, activate), tap(DOUBLE_TAP_ADMIN, activate)]);
    await awaitUploads();

    const fileUrl = `${PUBLIC_BASE}/videos/bot/${uniqueId}.mp4`;
    expect(await db().select().from(videos).where(eq(videos.fileUrl, fileUrl))).toHaveLength(1);
    expect((await draftOf(uniqueId)).step).toBe("done");
    expect(sent().filter((call) => String(call.payload.text).startsWith("Faol qilindi"))).toHaveLength(1);
  });
});
