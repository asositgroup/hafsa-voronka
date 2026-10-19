import type { z } from "zod";
import {
  type FunnelSegment,
  type MessageTemplate,
  type MessageTemplateInput,
  type MessageTemplatesResponse,
  messageTemplateSchema,
  messageTemplatesResponseSchema,
  templateMediaUploadSchema,
} from "@funnel/shared";
import { API_URL } from "@/lib/api";
import { authHeaders } from "@/lib/admin/api";

export type MessagesResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error?: string; variable?: string };

async function call<T>(path: string, parse: (json: unknown) => T, init: RequestInit = {}): Promise<MessagesResult<T>> {
  try {
    const res = await fetch(`${API_URL}/admin/messages${path}`, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(typeof init.body === "string" ? { "content-type": "application/json" } : {}),
        ...(init.headers as Record<string, string>),
      },
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: json?.error, variable: json?.variable };
    return { ok: true, data: parse(json) };
  } catch {
    return { ok: false, status: 0, error: "network_error" };
  }
}

const itemsSchema = messageTemplatesResponseSchema.pick({ items: true });

export function fetchMessages(segment: FunnelSegment) {
  return call(`?segment=${segment}`, (json): MessageTemplatesResponse => messageTemplatesResponseSchema.parse(json));
}

export function createMessage(input: MessageTemplateInput) {
  return call("", (json) => messageTemplateSchema.parse(json), { method: "POST", body: JSON.stringify(input) });
}

export function updateMessage(id: number, input: MessageTemplateInput) {
  return call(`/${id}`, (json) => messageTemplateSchema.parse(json), { method: "PUT", body: JSON.stringify(input) });
}

export function setMessageActive(id: number, isActive: boolean) {
  return call(`/${id}/active`, (json) => messageTemplateSchema.parse(json), {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteMessage(id: number) {
  return call(`/${id}`, () => true, { method: "DELETE" });
}

export function reorderMessages(segment: FunnelSegment, day: number, ids: number[]) {
  return call("/order", (json) => itemsSchema.parse(json).items, {
    method: "PUT",
    body: JSON.stringify({ segment, day, ids }),
  });
}

export function uploadMessageMedia(file: File) {
  const form = new FormData();
  form.append("file", file);
  return call("/media", (json): z.infer<typeof templateMediaUploadSchema> => templateMediaUploadSchema.parse(json), {
    method: "POST",
    body: form,
  });
}

export function sendTestMessage(draft: MessageTemplateInput, adminTelegramId: number, templateId?: number) {
  return call("/test", () => true, {
    method: "POST",
    body: JSON.stringify({ draft, adminTelegramId, templateId }),
  });
}

export function messageMediaUrl(item: Pick<MessageTemplate, "id" | "updatedAt">) {
  return `${API_URL}/admin/messages/${item.id}/media?v=${encodeURIComponent(item.updatedAt)}`;
}
