import { type DriveImportError, VIDEO_MAX_BYTES } from "@funnel/shared";
import { googleAuthHeaders } from "@/sheets";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const METADATA_TIMEOUT_MS = 15_000;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;
const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

export type DriveFileRef = { fileId: string; resourceKey?: string };

export type DriveVideo = {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  durationSec: number;
};

export class DriveError extends Error {
  constructor(readonly code: DriveImportError) {
    super(code);
  }
}

export function parseDriveLink(input: string): DriveFileRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !DRIVE_HOSTS.has(url.hostname)) return null;

  const fromPath = /^\/(?:u\/\d+\/)?file\/d\/([^/]+)/.exec(url.pathname)?.[1];
  const fromQuery = url.pathname === "/open" || url.pathname === "/uc" ? url.searchParams.get("id") : null;
  const fileId = fromPath ?? fromQuery;
  if (!fileId || !FILE_ID_PATTERN.test(fileId)) return null;

  const resourceKey = url.searchParams.get("resourcekey");
  return resourceKey ? { fileId, resourceKey } : { fileId };
}

async function driveHeaders(ref: DriveFileRef) {
  const headers = new Headers(await googleAuthHeaders());
  if (ref.resourceKey) headers.set("X-Goog-Drive-Resource-Keys", `${ref.fileId}/${ref.resourceKey}`);
  return headers;
}

function fileUrl(ref: DriveFileRef, params: Record<string, string>) {
  const query = new URLSearchParams({ supportsAllDrives: "true", ...params });
  return `${DRIVE_FILES_URL}/${encodeURIComponent(ref.fileId)}?${query}`;
}

type DriveFileMetadata = {
  name?: string;
  mimeType?: string;
  size?: string;
  videoMediaMetadata?: { durationMillis?: string };
};

export async function getDriveVideo(ref: DriveFileRef): Promise<DriveVideo> {
  let response: Response;
  try {
    response = await fetch(
      fileUrl(ref, { fields: "id,name,mimeType,size,videoMediaMetadata(durationMillis)" }),
      { headers: await driveHeaders(ref), signal: AbortSignal.timeout(METADATA_TIMEOUT_MS) },
    );
  } catch {
    throw new DriveError("drive_unavailable");
  }

  if (response.status === 403 || response.status === 404) throw new DriveError("not_shared");
  if (!response.ok) throw new DriveError("drive_unavailable");

  const metadata = (await response.json()) as DriveFileMetadata;
  const size = Number(metadata.size);
  if (metadata.mimeType !== "video/mp4" || !Number.isFinite(size) || size <= 0) throw new DriveError("not_mp4");
  if (size > VIDEO_MAX_BYTES) throw new DriveError("too_large");

  const durationMillis = Number(metadata.videoMediaMetadata?.durationMillis);
  if (!Number.isFinite(durationMillis) || durationMillis <= 0) throw new DriveError("no_duration");

  return {
    fileId: ref.fileId,
    name: metadata.name ?? "video.mp4",
    mimeType: metadata.mimeType,
    size,
    durationSec: Math.max(1, Math.round(durationMillis / 1000)),
  };
}

export async function downloadDriveFile(ref: DriveFileRef, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  try {
    response = await fetch(fileUrl(ref, { alt: "media" }), { headers: await driveHeaders(ref), signal });
  } catch {
    throw new DriveError("download_failed");
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new DriveError("download_failed");
  }
  return response.body;
}
