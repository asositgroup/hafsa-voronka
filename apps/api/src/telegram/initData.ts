import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_AGE_SECONDS = 24 * 60 * 60;

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: number; startParam?: string }
  | { ok: false; reason: "missing" | "bad_hash" | "expired" | "bad_user" };

export function signInitData(params: URLSearchParams, botToken: string) {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

export function verifyInitData(
  raw: string | null | undefined,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): InitDataResult {
  if (!raw) return { ok: false, reason: "missing" };

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "bad_hash" };

  const expected = Buffer.from(signInitData(params, botToken), "hex");
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowSeconds - authDate > MAX_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  let userJson: unknown;
  try {
    userJson = JSON.parse(params.get("user") ?? "");
  } catch {
    return { ok: false, reason: "bad_user" };
  }
  const user = telegramUserSchema.safeParse(userJson);
  if (!user.success) return { ok: false, reason: "bad_user" };

  return {
    ok: true,
    user: user.data,
    authDate,
    startParam: params.get("start_param") ?? undefined,
  };
}

export function initDataFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("tma ")) return header.slice(4);
  return null;
}
