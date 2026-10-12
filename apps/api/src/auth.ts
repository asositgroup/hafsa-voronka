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

export const initDataAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const raw = initDataFromRequest(c.req.raw);
    const result = verifyInitData(raw, env.BOT_TOKEN);
    if (!result.ok) {
      return c.json({ error: result.reason }, 401);
    }
    c.set("telegramUser", result.user);
    if (result.startParam) {
      c.set("startParam", result.startParam);
    }
    await next();
  },
);
