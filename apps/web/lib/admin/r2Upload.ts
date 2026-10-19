import type { VideoUploadKind } from "@funnel/shared";
import { abortUpload, completeUpload, startUpload } from "@/lib/admin/videos";

const PARALLEL_PARTS = 3;
const PART_RETRIES = 3;

type UploadOptions = {
  onProgress?: (uploadedBytes: number) => void;
  signal?: AbortSignal;
};

function putPart(
  url: string,
  body: Blob,
  onBytes: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => onBytes(event.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(`part_failed_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function putPartWithRetry(
  url: string,
  body: Blob,
  onBytes: (loaded: number) => void,
  signal?: AbortSignal,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      onBytes(0);
      return await putPart(url, body, onBytes, signal);
    } catch (error) {
      if (signal?.aborted || attempt >= PART_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

export async function uploadVideoFile(file: File, kind: VideoUploadKind, options: UploadOptions = {}) {
  const { onProgress, signal } = options;
  const session = await startUpload({ kind, size: file.size });
  const loadedByPart = new Map<number, number>();
  const report = () => {
    let total = 0;
    for (const loaded of loadedByPart.values()) total += loaded;
    onProgress?.(Math.min(total, file.size));
  };

  const etags: { partNumber: number; etag: string }[] = [];
  const queue = [...session.parts];

  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      const start = (part.partNumber - 1) * session.partSize;
      const blob = file.slice(start, Math.min(start + session.partSize, file.size));
      const etag = await putPartWithRetry(
        part.url,
        blob,
        (loaded) => {
          loadedByPart.set(part.partNumber, loaded);
          report();
        },
        signal,
      );
      loadedByPart.set(part.partNumber, blob.size);
      report();
      etags.push({ partNumber: part.partNumber, etag });
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, session.parts.length) }, worker));
    return await completeUpload({ key: session.key, uploadId: session.uploadId, parts: etags });
  } catch (error) {
    queue.length = 0;
    await abortUpload({ key: session.key, uploadId: session.uploadId });
    throw error;
  }
}
