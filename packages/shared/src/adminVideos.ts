import { z } from "zod";

export const VIDEO_PART_SIZE = 16 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 4 * 1024 ** 3;
export const videoUploadKinds = ["main", "offer"] as const;
export type VideoUploadKind = (typeof videoUploadKinds)[number];

export const videoMarkErrors = [
  "mark_negative",
  "intro_after_course",
  "course_after_price",
  "price_after_duration",
  "unlock_out_of_range",
] as const;
export type VideoMarkError = (typeof videoMarkErrors)[number];

export type VideoMarks = {
  introEndSec?: number | null;
  courseStartSec?: number | null;
  priceSec?: number | null;
  unlockSec?: number | null;
};

export const DEFAULT_LESSON_START_SEC = 300;

export function defaultLessonStartSec(
  marks: Pick<VideoMarks, "courseStartSec" | "priceSec">,
  duration: number,
): number {
  const lessonEnd = marks.courseStartSec ?? marks.priceSec ?? duration;
  return Math.max(0, Math.min(DEFAULT_LESSON_START_SEC, lessonEnd - 1));
}

export function validateVideoMarks(
  marks: VideoMarks,
  duration: number,
  options: { requirePrice: boolean },
): VideoMarkError | "price_required" | null {
  const { introEndSec, courseStartSec, priceSec, unlockSec } = marks;
  const values = [introEndSec, courseStartSec, priceSec, unlockSec];
  if (values.some((value) => value != null && value < 0) || courseStartSec === 0) return "mark_negative";
  if (options.requirePrice && priceSec == null) return "price_required";
  if (priceSec != null && priceSec >= duration) return "price_after_duration";
  if (unlockSec != null && (unlockSec <= 0 || unlockSec >= duration)) return "unlock_out_of_range";
  if (courseStartSec != null && priceSec != null && courseStartSec >= priceSec) return "course_after_price";
  if (introEndSec != null && introEndSec >= (courseStartSec ?? priceSec ?? duration)) {
    return "intro_after_course";
  }
  return null;
}

const urlSchema = z.url();
const markSchema = z.number().int().min(0).nullable();

export const videoItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  fileUrl: z.string(),
  duration: z.number(),
  introEndSec: z.number().nullable(),
  courseStartSec: z.number().nullable(),
  priceSec: z.number().nullable(),
  unlockSec: z.number().nullable(),
  shortOfferVideoUrl: z.string().nullable(),
  isActive: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  userCount: z.number(),
});

export type AdminVideoItem = z.infer<typeof videoItemSchema>;

export const videosResponseSchema = z.object({
  items: z.array(videoItemSchema),
  uploadsEnabled: z.boolean(),
});

export type VideosResponse = z.infer<typeof videosResponseSchema>;

const titleSchema = z.string().trim().min(1).max(120);

export const videoCreateSchema = z.object({
  title: titleSchema,
  fileUrl: urlSchema,
  duration: z.number().int().positive(),
  shortOfferVideoUrl: urlSchema.nullish(),
});

export type VideoCreate = z.infer<typeof videoCreateSchema>;

export const videoUpdateSchema = z
  .object({
    title: titleSchema.optional(),
    introEndSec: markSchema.optional(),
    courseStartSec: markSchema.optional(),
    priceSec: markSchema.optional(),
    unlockSec: markSchema.optional(),
    shortOfferVideoUrl: urlSchema.nullable().optional(),
  })
  .strict();

export type VideoUpdate = z.infer<typeof videoUpdateSchema>;

export const uploadStartRequestSchema = z.object({
  kind: z.enum(videoUploadKinds),
  size: z.number().int().min(1).max(VIDEO_MAX_BYTES),
});

export type UploadStartRequest = z.infer<typeof uploadStartRequestSchema>;

export const uploadStartResponseSchema = z.object({
  key: z.string(),
  uploadId: z.string(),
  partSize: z.number(),
  parts: z.array(z.object({ partNumber: z.number(), url: z.string() })),
});

export type UploadStartResponse = z.infer<typeof uploadStartResponseSchema>;

export const uploadCompleteRequestSchema = z.object({
  key: z.string(),
  uploadId: z.string(),
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10000), etag: z.string().min(1) }))
    .min(1),
});

export type UploadCompleteRequest = z.infer<typeof uploadCompleteRequestSchema>;

export const uploadCompleteResponseSchema = z.object({ fileUrl: z.string() });

export const uploadAbortRequestSchema = z.object({ key: z.string(), uploadId: z.string() });
