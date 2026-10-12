import {
  registerErrorSchema,
  registerRequestSchema,
  registerResponseSchema,
  sessionResponseSchema,
  type RegisterRequest,
  type SessionResponse,
} from "@funnel/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type RegisterResult =
  | { ok: true }
  | { ok: false; field?: "name" | "phone"; message: string };

export async function fetchSession(initData: string): Promise<SessionResponse> {
  const res = await fetch(`${API_URL}/app/session`, {
    method: "POST",
    headers: {
      authorization: `tma ${initData}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Session request failed: ${res.status}`);
  }

  const json = await res.json();
  return sessionResponseSchema.parse(json);
}

export async function registerUser(
  initData: string,
  data: RegisterRequest,
): Promise<RegisterResult> {
  registerRequestSchema.parse(data);

  const res = await fetch(`${API_URL}/app/register`, {
    method: "POST",
    headers: {
      authorization: `tma ${initData}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (res.status === 200) {
    const json = await res.json();
    registerResponseSchema.parse(json);
    return { ok: true };
  }

  if (res.status === 422) {
    const json = await res.json().catch(() => ({}));
    const parsed = registerErrorSchema.safeParse(json);
    if (parsed.success) {
      return { ok: false, field: parsed.data.field, message: parsed.data.message };
    }
    return { ok: false, message: "Noto'g'ri ma'lumot kiritildi" };
  }

  return { ok: false, message: "Serverda xatolik yuz berdi" };
}
