import {
  type AdminVideoItem,
  type RolloutCreate,
  type RolloutFilter,
  type VideoRollout,
  type UploadCompleteRequest,
  type UploadStartRequest,
  type UploadStartResponse,
  type VideoCreate,
  type VideoUpdate,
  uploadCompleteResponseSchema,
  rolloutPreviewResponseSchema,
  rolloutResponseSchema,
  rolloutsResponseSchema,
  uploadStartResponseSchema,
  videosResponseSchema,
} from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders } from "@/lib/admin/api";

export type VideosResult =
  | { ok: true; items: AdminVideoItem[]; uploadsEnabled: boolean }
  | { ok: false; status: number; error?: string; userCount?: number };

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}/admin/videos${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers as Record<string, string>),
    },
    credentials: "include",
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function call(path: string, init: RequestInit = {}): Promise<VideosResult> {
  try {
    const { res, json } = await request(path, init);
    if (!res.ok) return { ok: false, status: res.status, error: json?.error, userCount: json?.userCount };
    const parsed = videosResponseSchema.parse(json);
    return { ok: true, items: parsed.items, uploadsEnabled: parsed.uploadsEnabled };
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
}

const post = (path: string, body?: unknown) =>
  call(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const fetchVideos = () => call("");
export const createVideo = (input: VideoCreate) => post("", input);
export const updateVideo = (id: number, patch: VideoUpdate) =>
  call(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const activateVideo = (id: number) => post(`/${id}/activate`);
export const archiveVideo = (id: number) => post(`/${id}/archive`);
export const unarchiveVideo = (id: number) => post(`/${id}/unarchive`);
export const moveAllUsersToVideo = (id: number) => post(`/${id}/move-users`);
export const deleteVideo = (id: number) => call(`/${id}`, { method: "DELETE" });

export type RolloutResult<T> = { ok: true; data: T } | { ok: false; status: number; error?: string };

async function rolloutCall<T>(
  path: string,
  parse: (json: unknown) => T,
  init: RequestInit = {},
): Promise<RolloutResult<T>> {
  try {
    const { res, json } = await request(path, init);
    if (!res.ok) return { ok: false, status: res.status, error: json?.error };
    return { ok: true, data: parse(json) };
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
}

const postJson = (body?: unknown): RequestInit => ({
  method: "POST",
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const previewRollout = (id: number, filter: RolloutFilter, signal?: AbortSignal) =>
  rolloutCall(
    `/${id}/rollouts/preview`,
    (json) => rolloutPreviewResponseSchema.parse(json).count,
    { ...postJson(filter), signal },
  );
export const fetchRollouts = (id: number) =>
  rolloutCall(`/${id}/rollouts`, (json): VideoRollout[] => rolloutsResponseSchema.parse(json).items);
export const createRollout = (id: number, input: RolloutCreate) =>
  rolloutCall(`/${id}/rollouts`, (json) => rolloutResponseSchema.parse(json).rollout, postJson(input));
export const cancelRollout = (id: number, rolloutId: number) =>
  rolloutCall(`/${id}/rollouts/${rolloutId}/cancel`, (json) => rolloutResponseSchema.parse(json).rollout, postJson());

export async function startUpload(body: UploadStartRequest): Promise<UploadStartResponse> {
  const { res, json } = await request("/uploads", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(json?.error ?? "upload_start_failed");
  return uploadStartResponseSchema.parse(json);
}

export async function completeUpload(body: UploadCompleteRequest): Promise<string> {
  const { res, json } = await request("/uploads/complete", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(json?.error ?? "upload_complete_failed");
  return uploadCompleteResponseSchema.parse(json).fileUrl;
}

export async function abortUpload(body: { key: string; uploadId: string }) {
  await request("/uploads/abort", { method: "POST", body: JSON.stringify(body) }).catch(() => {});
}
