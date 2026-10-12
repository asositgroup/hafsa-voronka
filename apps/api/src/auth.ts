import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { env } from "@/env";
import {
  initDataFromRequest,
  type TelegramUser,
  verifyInitData,
} from "@/telegram/initData";

export type AuthVariables = {
  telegramUser: TelegramUser;
  startParam?: string;
};

export type AppEnv = { Variables: AuthVariables };

async function initDataFromBody(c: Context) {
  try {
    const body: unknown = await c.req.json();
    if (body && typeof body === "object" && "initData" in body && typeof body.initData === "string") {
      return body.initData;
    }
  } catch {
    return null;
  }
  return null;
}

export const initDataAuth = createMiddleware<AppEnv>(async (c, next) => {
  const raw = initDataFromRequest(c.req.raw) ?? (await initDataFromBody(c));
  const result = verifyInitData(raw, env.BOT_TOKEN);
  if (!result.ok) {
    return c.json({ error: result.reason }, 401);
  }
  c.set("telegramUser", result.user);
  if (result.startParam) {
    c.set("startParam", result.startParam);
  }
  await next();
});
