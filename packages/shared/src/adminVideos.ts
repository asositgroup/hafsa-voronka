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

export const videoMarkKeys = ["introEndSec", "courseStartSec", "priceSec", "unlockSec"] as const;
export type VideoMarkKey = (typeof videoMarkKeys)[number];

export type VideoMarkRange = {
  min: number;
  max: number;
  after: VideoMarkKey | null;
  before: VideoMarkKey | null;
};

function firstSet(marks: VideoMarks, keys: VideoMarkKey[]): VideoMarkKey | null {
  return keys.find((key) => marks[key] != null) ?? null;
}

const markNeighbours: Record<VideoMarkKey, { after: VideoMarkKey[]; before: VideoMarkKey[]; floor: number }> = {
  introEndSec: { after: [], before: ["courseStartSec", "priceSec"], floor: 0 },
  courseStartSec: { after: ["introEndSec"], before: ["priceSec"], floor: 1 },
  priceSec: { after: ["courseStartSec", "introEndSec"], before: [], floor: 0 },
  unlockSec: { after: [], before: [], floor: 1 },
};

export function markRange(mark: VideoMarkKey, marks: VideoMarks, duration: number): VideoMarkRange {
  const neighbours = markNeighbours[mark];
  const after = firstSet(marks, neighbours.after);
  const before = firstSet(marks, neighbours.before);
  return {
    min: after ? marks[after]! + 1 : neighbours.floor,
    max: (before ? marks[before]! : duration) - 1,
    after,
    before,
  };
}

export function isInMarkRange(range: VideoMarkRange, value: number) {
  return value >= range.min && value <= range.max;
}

const markOrderErrors: Record<VideoMarkKey, VideoMarkError> = {
  priceSec: "price_after_duration",
  unlockSec: "unlock_out_of_range",
  courseStartSec: "course_after_price",
  introEndSec: "intro_after_course",
};

const markFloorErrors: Record<VideoMarkKey, VideoMarkError> = {
  priceSec: "mark_negative",
  unlockSec: "unlock_out_of_range",
  courseStartSec: "mark_negative",
  introEndSec: "mark_negative",
};

export function validateVideoMarks(
  marks: VideoMarks,
  duration: number,
  options: { requirePrice: boolean },
): VideoMarkError | "price_required" | null {
  if (videoMarkKeys.some((key) => marks[key] != null && marks[key] < 0)) return "mark_negative";
  if (options.requirePrice && marks.priceSec == null) return "price_required";
  for (const key of ["priceSec", "unlockSec", "courseStartSec", "introEndSec"] as const) {
    const value = marks[key];
    if (value == null) continue;
    const range = markRange(key, marks, duration);
    if (value > range.max) return markOrderErrors[key];
    if (range.after === null && value < range.min) return markFloorErrors[key];
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
  shortOfferDuration: z.number().nullable(),
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
  shortOfferDuration: z.number().int().positive().nullish(),
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
    shortOfferDuration: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((patch) => typeof patch.shortOfferVideoUrl !== "string" || typeof patch.shortOfferDuration === "number", {
    path: ["shortOfferDuration"],
  });

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

export const driveImportStatuses = ["running", "done", "failed"] as const;
export type DriveImportStatus = (typeof driveImportStatuses)[number];

export const driveImportErrors = [
  "invalid_link",
  "not_shared",
  "not_mp4",
  "too_large",
  "no_duration",
  "drive_unavailable",
  "download_failed",
  "interrupted",
] as const;
export type DriveImportError = (typeof driveImportErrors)[number];

export const driveConfigSchema = z.object({
  enabled: z.boolean(),
  serviceAccountEmail: z.string().nullable(),
});

export type DriveConfig = z.infer<typeof driveConfigSchema>;

export const driveImportRequestSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  title: titleSchema.optional(),
});

export type DriveImportRequest = z.infer<typeof driveImportRequestSchema>;

export const driveImportSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  status: z.enum(driveImportStatuses),
  bytesDone: z.number(),
  totalBytes: z.number(),
  error: z.enum(driveImportErrors).nullable(),
  videoId: z.number().int().nullable(),
});

export type DriveImport = z.infer<typeof driveImportSchema>;
