import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { AwsClient } from "aws4fetch";
import { VIDEO_PART_SIZE } from "@funnel/shared";
import { env } from "@/env";

export type R2Part = { partNumber: number; etag: string };

export type R2Store = {
  createMultipart(key: string, contentType: string): Promise<string>;
  presignPart(key: string, uploadId: string, partNumber: number, expiresSec: number): Promise<string>;
  uploadPart(key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<string>;
  completeMultipart(key: string, uploadId: string, parts: R2Part[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string;
};

export class R2NotConfiguredError extends Error {}
export class UploadTooLargeError extends Error {}

const MAX_PARTS_IN_FLIGHT = 2;
const PART_RETRY_DELAYS_MS = [1000, 2000, 4000];

async function expectOk(res: Response, action: string, allowed: number[] = []) {
  if (res.ok || allowed.includes(res.status)) return res;
  throw new Error(`R2 ${action} failed with ${res.status}: ${await res.text().catch(() => "")}`);
}

function buildStore(config: {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}): R2Store {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const objectUrl = (key: string) =>
    `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    async createMultipart(key, contentType) {
      const res = await expectOk(
        await client.fetch(`${objectUrl(key)}?uploads`, {
          method: "POST",
          headers: { "Content-Type": contentType },
        }),
        "create multipart",
      );
      const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(await res.text())?.[1];
      if (!uploadId) throw new Error("R2 create multipart returned no upload id");
      return uploadId;
    },

    async presignPart(key, uploadId, partNumber, expiresSec) {
      const url = `${objectUrl(key)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}&X-Amz-Expires=${expiresSec}`;
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },

    async uploadPart(key, uploadId, partNumber, body) {
      const res = await expectOk(
        await client.fetch(`${objectUrl(key)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`, {
          method: "PUT",
          body: body as BodyInit,
        }),
        "upload part",
      );
      const etag = res.headers.get("etag");
      if (!etag) throw new Error("R2 upload part returned no etag");
      return etag;
    },

    async completeMultipart(key, uploadId, parts) {
      const xml = [...parts]
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`)
        .join("");
      const res = await expectOk(
        await client.fetch(`${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, {
          method: "POST",
          body: `<CompleteMultipartUpload>${xml}</CompleteMultipartUpload>`,
        }),
        "complete multipart",
      );
      const text = await res.text();
      if (text.includes("<Error>")) throw new Error(`R2 complete multipart failed: ${text}`);
    },

    async abortMultipart(key, uploadId) {
      await expectOk(
        await client.fetch(`${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" }),
        "abort multipart",
        [404],
      );
    },

    async deleteObject(key) {
      await expectOk(await client.fetch(objectUrl(key), { method: "DELETE" }), "delete object", [404]);
    },

    publicUrl(key) {
      return `${config.publicBaseUrl}/${key}`;
    },
  };
}

let testStore: R2Store | null = null;
let cached: { signature: string; store: R2Store } | null = null;

export function setR2ForTests(store: R2Store | null) {
  testStore = store;
}

export function r2(): R2Store | null {
  if (testStore) return testStore;

  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) return null;

  const signature = [accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl].join("|");
  if (cached?.signature !== signature) {
    cached = { signature, store: buildStore({ accountId, bucket, accessKeyId, secretAccessKey, publicBaseUrl }) };
  }
  return cached.store;
}

const browserKeyPattern = /^videos\/[0-9a-f-]{36}\/(main|offer)\.mp4$/;

export function newVideoKey(kind: "main" | "offer") {
  return `videos/${randomUUID()}/${kind}.mp4`;
}

export function botVideoKey(fileUniqueId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(fileUniqueId)) throw new Error("Invalid file id for bot video key");
  return `videos/bot/${fileUniqueId}.mp4`;
}

export function isBrowserUploadKey(key: string) {
  return browserKeyPattern.test(key);
}

export function keyFromPublicUrl(url: string): string | null {
  const base = env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  const prefix = `${base}/`;
  if (!url.startsWith(prefix) || url.length === prefix.length) return null;
  return url.slice(prefix.length);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function uploadPartWithRetry(
  store: R2Store,
  key: string,
  uploadId: string,
  partNumber: number,
  body: Uint8Array,
): Promise<R2Part> {
  for (let attempt = 0; ; attempt++) {
    try {
      return { partNumber, etag: await store.uploadPart(key, uploadId, partNumber, body) };
    } catch (error) {
      const delay = PART_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) throw error;
      await sleep(delay);
    }
  }
}

export async function uploadStream(input: {
  key: string;
  body: Readable | ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
  maxBytes?: number;
  onProgress?: (bytes: number) => void;
  onChunk?: (chunk: Uint8Array) => void;
  beforeComplete?: () => void | Promise<void>;
  signal?: AbortSignal;
}): Promise<{ key: string; url: string }> {
  const store = r2();
  if (!store) throw new R2NotConfiguredError("R2 is not configured");

  if (input.maxBytes !== undefined && input.contentLength !== undefined && input.contentLength > input.maxBytes) {
    throw new UploadTooLargeError("Upload exceeds the size limit");
  }

  const uploadId = await store.createMultipart(input.key, input.contentType);
  const source =
    input.body instanceof Readable ? input.body : Readable.fromWeb(input.body as NodeReadableStream<Uint8Array>);

  const parts: R2Part[] = [];
  const inFlight = new Set<Promise<void>>();
  let failure: unknown = null;
  let partNumber = 0;
  let total = 0;

  const dispatch = async (buffer: Uint8Array) => {
    while (inFlight.size >= MAX_PARTS_IN_FLIGHT) await Promise.race(inFlight);
    if (failure) throw failure;
    const number = ++partNumber;
    const task: Promise<void> = uploadPartWithRetry(store, input.key, uploadId, number, buffer)
      .then((part) => {
        parts.push(part);
      })
      .catch((error: unknown) => {
        failure ??= error;
      })
      .finally(() => {
        inFlight.delete(task);
      });
    inFlight.add(task);
  };

  try {
    let buffer = new Uint8Array(VIDEO_PART_SIZE);
    let filled = 0;

    for await (const raw of source) {
      input.signal?.throwIfAborted();
      if (failure) throw failure;
      const chunk: Uint8Array = typeof raw === "string" ? Buffer.from(raw) : raw;
      total += chunk.byteLength;
      if (input.maxBytes !== undefined && total > input.maxBytes) {
        throw new UploadTooLargeError("Upload exceeds the size limit");
      }
      input.onChunk?.(chunk);
      input.onProgress?.(total);

      let offset = 0;
      while (offset < chunk.byteLength) {
        const take = Math.min(chunk.byteLength - offset, VIDEO_PART_SIZE - filled);
        buffer.set(chunk.subarray(offset, offset + take), filled);
        filled += take;
        offset += take;
        if (filled === VIDEO_PART_SIZE) {
          await dispatch(buffer);
          buffer = new Uint8Array(VIDEO_PART_SIZE);
          filled = 0;
        }
      }
    }

    if (total === 0) throw new Error("Upload body is empty");
    if (filled > 0) await dispatch(buffer.slice(0, filled));
    await Promise.all(inFlight);
    if (failure) throw failure;
    input.signal?.throwIfAborted();

    await input.beforeComplete?.();
    await store.completeMultipart(input.key, uploadId, parts);
    return { key: input.key, url: store.publicUrl(input.key) };
  } catch (error) {
    await Promise.all(inFlight);
    await store.abortMultipart(input.key, uploadId).catch(() => {});
    throw error;
  }
}
