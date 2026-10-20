import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_PART_SIZE } from "@funnel/shared";
import { setTestEnv } from "@/test/env";
import {
  type R2Store,
  UploadTooLargeError,
  isBrowserUploadKey,
  keyFromPublicUrl,
  newVideoKey,
  botVideoKey,
  setR2ForTests,
  uploadStream,
} from "./r2";

const MIB = 1024 * 1024;

function stubStore(overrides: Partial<R2Store> = {}) {
  const uploaded: { partNumber: number; size: number }[] = [];
  const store: R2Store = {
    createMultipart: vi.fn(async () => "upload-1"),
    presignPart: vi.fn(async () => "https://signed.example.com"),
    uploadPart: vi.fn(async (_key, _id, partNumber, body) => {
      uploaded.push({ partNumber, size: body.byteLength });
      return `etag-${partNumber}`;
    }),
    completeMultipart: vi.fn(async () => {}),
    abortMultipart: vi.fn(async () => {}),
    deleteObject: vi.fn(async () => {}),
    publicUrl: (key) => `https://video.example.com/${key}`,
    ...overrides,
  };
  return { store, uploaded };
}

function chunks(total: number, chunkSize = 5 * MIB) {
  let remaining = total;
  return Readable.from(
    (function* () {
      while (remaining > 0) {
        const size = Math.min(chunkSize, remaining);
        remaining -= size;
        yield new Uint8Array(size);
      }
    })(),
  );
}

beforeEach(() => {
  setTestEnv({
    R2_ACCOUNT_ID: "acc",
    R2_BUCKET: "funnel-video",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_BASE_URL: "https://video.example.com",
  });
});

afterEach(() => {
  setR2ForTests(null);
  vi.useRealTimers();
});

describe("uploadStream", () => {
  it("splits the body into 16 MiB parts and completes with sorted etags", async () => {
    const { store, uploaded } = stubStore();
    setR2ForTests(store);
    const progress: number[] = [];
    const seen: number[] = [];

    const result = await uploadStream({
      key: "videos/bot/abc.mp4",
      body: chunks(40 * MIB),
      contentType: "video/mp4",
      onProgress: (bytes) => progress.push(bytes),
      onChunk: (chunk) => seen.push(chunk.byteLength),
    });

    expect(uploaded.map((part) => part.size).sort((a, b) => a - b)).toEqual([8 * MIB, VIDEO_PART_SIZE, VIDEO_PART_SIZE]);
    expect(progress.at(-1)).toBe(40 * MIB);
    expect(seen.reduce((a, b) => a + b, 0)).toBe(40 * MIB);
    expect(store.completeMultipart).toHaveBeenCalledWith("videos/bot/abc.mp4", "upload-1", [
      { partNumber: 1, etag: "etag-1" },
      { partNumber: 2, etag: "etag-2" },
      { partNumber: 3, etag: "etag-3" },
    ]);
    expect(result).toEqual({ key: "videos/bot/abc.mp4", url: "https://video.example.com/videos/bot/abc.mp4" });
  });

  it("aborts the multipart upload when a part keeps failing", async () => {
    vi.useFakeTimers();
    const { store } = stubStore({
      uploadPart: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    setR2ForTests(store);

    const pending = uploadStream({ key: "videos/bot/x.mp4", body: chunks(MIB), contentType: "video/mp4" });
    const assertion = expect(pending).rejects.toThrow("boom");
    await vi.runAllTimersAsync();
    await assertion;

    expect(store.uploadPart).toHaveBeenCalledTimes(4);
    expect(store.abortMultipart).toHaveBeenCalledWith("videos/bot/x.mp4", "upload-1");
    expect(store.completeMultipart).not.toHaveBeenCalled();
  });

  it("aborts when beforeComplete throws", async () => {
    const { store } = stubStore();
    setR2ForTests(store);

    await expect(
      uploadStream({
        key: "videos/bot/y.mp4",
        body: chunks(MIB),
        contentType: "video/mp4",
        beforeComplete: () => {
          throw new Error("rejected");
        },
      }),
    ).rejects.toThrow("rejected");

    expect(store.abortMultipart).toHaveBeenCalled();
    expect(store.completeMultipart).not.toHaveBeenCalled();
  });

  it("rejects an empty body and an oversized body", async () => {
    const { store } = stubStore();
    setR2ForTests(store);

    await expect(uploadStream({ key: "k", body: chunks(0), contentType: "video/mp4" })).rejects.toThrow();
    await expect(
      uploadStream({ key: "k", body: chunks(3 * MIB), contentType: "video/mp4", maxBytes: 2 * MIB }),
    ).rejects.toBeInstanceOf(UploadTooLargeError);
    expect(store.abortMultipart).toHaveBeenCalledTimes(2);
  });
});

describe("keys", () => {
  it("builds and recognises browser upload keys", () => {
    expect(isBrowserUploadKey(newVideoKey("main"))).toBe(true);
    expect(isBrowserUploadKey(newVideoKey("offer"))).toBe(true);
    expect(isBrowserUploadKey("videos/bot/abc.mp4")).toBe(false);
    expect(isBrowserUploadKey("../etc/passwd")).toBe(false);
  });

  it("validates bot keys", () => {
    expect(botVideoKey("AgAD_x-1")).toBe("videos/bot/AgAD_x-1.mp4");
    expect(() => botVideoKey("../x")).toThrow();
  });

  it("maps public urls back to keys", () => {
    expect(keyFromPublicUrl("https://video.example.com/videos/a/main.mp4")).toBe("videos/a/main.mp4");
    expect(keyFromPublicUrl("https://other.example.com/videos/a/main.mp4")).toBeNull();
  });
});
