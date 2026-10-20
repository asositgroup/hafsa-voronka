import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import type { Api } from "grammy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setTestEnv } from "@/test/env";

const runsAsRoot = process.getuid?.() === 0;

describe("openTelegramFile with a local Bot API server", () => {
  let dir: string;
  let files: typeof import("./files");

  beforeAll(async () => {
    setTestEnv();
    files = await import("./files");
    dir = await mkdtemp(join(tmpdir(), "tg-files-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const apiServing = (path: string) => ({ getFile: async () => ({ file_path: path, file_size: 5 }) }) as unknown as Api;

  it("streams a file the server saved to disk", async () => {
    const path = join(dir, "lesson.mp4");
    await writeFile(path, "video");
    const file = await files.openTelegramFile(apiServing(path), "file-id");
    expect(file.localPath).toBe(path);
    expect(await text(file.stream)).toBe("video");
  });

  it.skipIf(runsAsRoot)("rejects instead of crashing when the file is not readable", async () => {
    const path = join(dir, "private.mp4");
    await writeFile(path, "video");
    await chmod(path, 0o000);
    await expect(files.openTelegramFile(apiServing(path), "file-id")).rejects.toMatchObject({ code: "EACCES" });
  });
});
