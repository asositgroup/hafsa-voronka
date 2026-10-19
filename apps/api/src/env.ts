import { z } from "zod";

const booleanEnv = (defaultValue: boolean) =>
  z.union([z.boolean(), z.stringbool()]).default(defaultValue);

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    BOT_TOKEN: z.string().min(1),
    BOT_USERNAME: z.string().min(1),
    WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
    API_URL: z.url(),
    WEB_URL: z.url(),
    DATABASE_URL: z.url(),
    CHANNEL_URL: z.url(),
    VIDEO_URL: z.url().optional(),
    VIDEO_POSTER_URL: z.url(),
    VIDEO_DURATION_SEC: z.coerce.number().int().positive().optional(),
    SEEK_LOCK: booleanEnv(true),
    GATE_PROCEED: booleanEnv(true),
    COMPLETE_THRESHOLD: z.coerce.number().min(0.5).max(1).default(0.7),
    CORS_ORIGINS: z.string().optional(),
    SHEETS_ENABLED: booleanEnv(false),
    GOOGLE_SA_EMAIL: z.string().optional(),
    GOOGLE_SA_KEY: z
      .string()
      .optional()
      .transform((val) => (val ? val.replace(/\\+n/g, "\n") : undefined)),
    SHEET_ID: z.string().optional(),
    FB_PIXEL_ID: z.string().optional(),
    FB_CAPI_TOKEN: z.string().optional(),
    FB_TEST_EVENT_CODE: z.string().optional(),
    LEADS_CHAT_ID: z
      .string()
      .regex(/^(-?\d+|@[A-Za-z0-9_]{5,32})$/, "LEADS_CHAT_ID must be a numeric chat id or @channelname")
      .optional(),
    LEADS_THREAD_ID: z.coerce.number().int().positive().optional(),
    MEDIA_CHAT_ID: z
      .string()
      .regex(/^(-?\d+|@[A-Za-z0-9_]{5,32})$/, "MEDIA_CHAT_ID must be a numeric chat id or @channelname")
      .optional(),
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_PUBLIC_BASE_URL: z
      .url()
      .transform((value) => value.replace(/\/+$/, ""))
      .optional(),
    ADMIN_PASSWORD_HASH: z.string().optional(),
    SESSION_SECRET: z.string().min(32).optional(),
  })
  .superRefine((data, ctx) => {
    const r2Keys = [
      "R2_ACCOUNT_ID",
      "R2_BUCKET",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_PUBLIC_BASE_URL",
    ] as const;
    if (r2Keys.some((key) => data[key])) {
      for (const key of r2Keys) {
        if (!data[key]) {
          ctx.addIssue({
            code: "custom",
            message: `${key} is required when any R2 variable is set`,
            path: [key],
          });
        }
      }
    }
    if (data.SHEETS_ENABLED) {
      if (!data.GOOGLE_SA_EMAIL) {
        ctx.addIssue({
          code: "custom",
          message: "GOOGLE_SA_EMAIL is required when SHEETS_ENABLED is true",
          path: ["GOOGLE_SA_EMAIL"],
        });
      }
      if (!data.GOOGLE_SA_KEY) {
        ctx.addIssue({
          code: "custom",
          message: "GOOGLE_SA_KEY is required when SHEETS_ENABLED is true",
          path: ["GOOGLE_SA_KEY"],
        });
      }
      if (!data.SHEET_ID) {
        ctx.addIssue({
          code: "custom",
          message: "SHEET_ID is required when SHEETS_ENABLED is true",
          path: ["SHEET_ID"],
        });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

export function loadEnv() {
  parsed ??= schema.parse(
    Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")),
  );
  return parsed;
}

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return loadEnv()[key as keyof Env];
  },
});
