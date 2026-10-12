import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  BOT_TOKEN: z.string().min(1),
  BOT_USERNAME: z.string().min(1),
  WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
  API_URL: z.url(),
  WEB_URL: z.url(),
  DATABASE_URL: z.url(),
  CHANNEL_URL: z.url(),
});

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

export function loadEnv() {
  parsed ??= schema.parse(process.env);
  return parsed;
}

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return loadEnv()[key as keyof Env];
  },
});
