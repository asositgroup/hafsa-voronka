import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/admin/auth";
import { closeDb, db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { videoImports, videos } from "@/db/schema";
import { setR2ForTests, type R2Part, type R2Store } from "@/storage/r2";
import { setTestEnv } from "@/test/env";
import { isolatedDatabase } from "@/test/isolatedDb";

vi.mock("@/sheets", () => ({
  googleAuthHeaders: async () => new Headers({ authorization: "Bearer drive-token" }),
}));

const database = isolatedDatabase("vf_drive");
const PASSWORD = "drive-admin-password-2026";
const PUBLIC_BASE = "https://video.example.com";
const FILE_ID = "1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456";
const LINK = `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`;
const METADATA = {
  id: FILE_ID,
  name: "dars-1.mp4",
  mimeType: "video/mp4",
  size: "11",
  videoMediaMetadata: { durationMillis: "754000" },
};

describe.skipIf(!database.url)("Drive import", () => {
  let app: ReturnType<typeof import("@/app").createApp>;
  let awaitDriveImports: () => Promise<void>;
  let failInterruptedImports: () => Promise<void>;
  let token: string;
  const uploaded: Uint8Array[] = [];
  const completed: string[] = [];
  const aborted: string[] = [];
  const deleted: string[] = [];

  const store: R2Store = {
    createMultipart: vi.fn(async () => "upload-1"),
    presignPart: vi.fn(async () => "https://signed.example.com"),
    uploadPart: vi.fn(async (_key: string, _id: string, _number: number, body: Uint8Array) => {
      uploaded.push(body);
      return "etag";
    }),
    completeMultipart: vi.fn(async (key: string, _id: string, _parts: R2Part[]) => {
      completed.push(key);
    }),
    abortMultipart: vi.fn(async (key: string) => {
      aborted.push(key);
    }),
    deleteObject: vi.fn(async (key: string) => {
      deleted.push(key);
    }),
    publicUrl: (key) => `${PUBLIC_BASE}/${key}`,
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  function stubDrive(handlers: { metadata?: () => Response; media?: () => Response }) {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.get("alt") === "media") return (handlers.media ?? (() => new Response("hello world")))();
      return (handlers.metadata ?? (() => json(METADATA)))();
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const call = (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/admin/videos${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  const startImport = (body: unknown) => call("/drive/imports", { method: "POST", body });

  beforeAll(async () => {
    await database.create();
    setTestEnv({
      DATABASE_URL: database.url!,
      ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD),
      SESSION_SECRET: "drive-session-secret-0123456789abcdef",
      GOOGLE_SA_EMAIL: "importer@funnel.iam.gserviceaccount.com",
      GOOGLE_SA_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
      R2_ACCOUNT_ID: "acc",
      R2_BUCKET: "funnel-video",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_PUBLIC_BASE_URL: PUBLIC_BASE,
    });
    await runMigrations(database.url!);
    setR2ForTests(store);
    app = (await import("@/app")).createApp();
    ({ awaitDriveImports, failInterruptedImports } = await import("./imports"));

    const login = await app.request("/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    token = ((await login.json()) as { token: string }).token;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await awaitDriveImports();
    uploaded.length = 0;
    completed.length = 0;
    aborted.length = 0;
    deleted.length = 0;
    await db().delete(videoImports);
    await db().delete(videos);
  });

  afterAll(async () => {
    setR2ForTests(null);
    await closeDb();
    await database.drop();
  });

  it("exposes the service account email to share the file with", async () => {
    const response = await call("/drive");
    expect(await response.json()).toEqual({
      enabled: true,
      serviceAccountEmail: "importer@funnel.iam.gserviceaccount.com",
    });
  });

  it("streams the file into R2 and creates an inactive video with the Drive duration", async () => {
    const fetchMock = stubDrive({});

    const started = await startImport({ url: LINK });
    expect(started.status).toBe(202);
    const created = (await started.json()) as { id: number; title: string; status: string; totalBytes: number };
    expect(created).toMatchObject({ title: "dars-1", status: "running", totalBytes: 11 });

    await awaitDriveImports();
    const finished = (await (await call(`/drive/imports/${created.id}`)).json()) as {
      status: string;
      bytesDone: number;
      videoId: number;
      error: string | null;
    };
    expect(finished).toMatchObject({ status: "done", bytesDone: 11, error: null });

    const [video] = await db().select().from(videos).where(eq(videos.id, finished.videoId));
    expect(video).toMatchObject({ title: "dars-1", duration: 754, isActive: false });
    expect(video.fileUrl).toMatch(/^https:\/\/video\.example\.com\/videos\/[0-9a-f-]{36}\/main\.mp4$/);
    expect(completed).toEqual([video.fileUrl.replace(`${PUBLIC_BASE}/`, "")]);
    expect(Buffer.concat(uploaded).toString()).toBe("hello world");

    const driveUrls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(driveUrls.every((url) => url.origin === "https://www.googleapis.com")).toBe(true);
    expect(driveUrls.map((url) => url.searchParams.get("alt"))).toEqual([null, "media"]);
  });

  it("uses a custom title when given", async () => {
    stubDrive({});
    const started = await startImport({ url: LINK, title: "Asosiy dars" });
    expect(((await started.json()) as { title: string }).title).toBe("Asosiy dars");
  });

  it("rejects links that are not Drive files", async () => {
    const fetchMock = stubDrive({});
    const response = await startImport({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_link" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the admin to share the file when the service account has no access", async () => {
    stubDrive({ metadata: () => json({ error: { message: "File not found" } }, 404) });
    const response = await startImport({ url: LINK });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "not_shared" });
    expect(await db().select().from(videoImports)).toHaveLength(0);
  });

  it("rejects files that are not mp4", async () => {
    stubDrive({ metadata: () => json({ ...METADATA, mimeType: "video/x-matroska" }) });
    const response = await startImport({ url: LINK });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "not_mp4" });
  });

  it("fails the import, aborts the upload and creates no video when the download breaks", async () => {
    stubDrive({ media: () => new Response("denied", { status: 403 }) });

    const started = await startImport({ url: LINK });
    const { id } = (await started.json()) as { id: number };
    await awaitDriveImports();

    const failed = (await (await call(`/drive/imports/${id}`)).json()) as { status: string; error: string; videoId: null };
    expect(failed).toMatchObject({ status: "failed", error: "download_failed", videoId: null });
    expect(await db().select().from(videos)).toHaveLength(0);
    expect(completed).toHaveLength(0);
  });

  it("fails the import and aborts the upload when the stream breaks midway", async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello"));
        controller.error(new Error("connection reset"));
      },
    });
    stubDrive({ media: () => new Response(broken) });

    const started = await startImport({ url: LINK });
    const { id } = (await started.json()) as { id: number };
    await awaitDriveImports();

    const failed = (await (await call(`/drive/imports/${id}`)).json()) as { status: string; error: string };
    expect(failed).toMatchObject({ status: "failed", error: "download_failed" });
    expect(aborted).toHaveLength(1);
    expect(await db().select().from(videos)).toHaveLength(0);
  });

  it("allows only one running import at a time", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubDrive({
      media: () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              await gate;
              controller.enqueue(new TextEncoder().encode("hello world"));
              controller.close();
            },
          }),
        ),
    });

    expect((await startImport({ url: LINK })).status).toBe(202);
    const second = await startImport({ url: LINK });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "import_in_progress" });

    release();
    await awaitDriveImports();
    expect((await startImport({ url: LINK })).status).toBe(202);
  });

  it("marks imports interrupted by a restart as failed", async () => {
    const [row] = await db()
      .insert(videoImports)
      .values({ driveFileId: FILE_ID, title: "x", totalBytes: 10, durationSec: 5 })
      .returning();

    await failInterruptedImports();

    const [after] = await db().select().from(videoImports).where(eq(videoImports.id, row.id));
    expect(after).toMatchObject({ status: "failed", error: "interrupted" });
  });

  it("returns 404 for an unknown import", async () => {
    expect((await call("/drive/imports/999999")).status).toBe(404);
  });

  it("requires admin auth", async () => {
    const response = await app.request("/admin/videos/drive");
    expect(response.status).toBe(401);
  });
});
