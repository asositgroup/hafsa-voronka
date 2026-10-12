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
    VIDEO_URL: z.url(),
    VIDEO_POSTER_URL: z.url(),
    VIDEO_DURATION_SEC: z.coerce.number().int().positive(),
    SEEK_LOCK: booleanEnv(true),
    GATE_PROCEED: booleanEnv(true),
    CORS_ORIGINS: z.string().optional(),
    SHEETS_ENABLED: booleanEnv(false),
    GOOGLE_SA_EMAIL: z.string().optional(),
    GOOGLE_SA_KEY: z
      .string()
      .optional()
      .transform((val) => (val ? val.replace(/\\n/g, "\n") : undefined)),
    SHEET_ID: z.string().optional(),
  })
  .superRefine((data, ctx) => {
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
  parsed ??= schema.parse(process.env);
  return parsed;
}

export const env = new Proxy({} as Env, {
  get(_, key: string) {
    return loadEnv()[key as keyof Env];
  },
});
