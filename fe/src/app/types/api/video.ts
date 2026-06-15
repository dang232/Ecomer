import { z } from "zod";

// ─── Video pipeline status ───────────────────────────────────────────────────

export const videoStatusSchema = z.enum([
  "PENDING",
  "UPLOADING",
  "UPLOADED",
  "TRANSCODING",
  "TRANSCODED",
  "MODERATING",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "APPEAL_PENDING",
  "FAILED",
  "DELETED",
]);
export type VideoStatus = z.infer<typeof videoStatusSchema>;

// ─── Video context — where the video is attached ────────────────────────────

export const videoContextSchema = z.enum(["PRODUCT", "REVIEW"]);
export type VideoContext = z.infer<typeof videoContextSchema>;

// ─── Core video record ───────────────────────────────────────────────────────

export const videoSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  context: videoContextSchema,
  status: videoStatusSchema,
  originalFilename: z.string().optional(),
  durationSeconds: z.number().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  uploadedAt: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
});
export type Video = z.infer<typeof videoSchema>;

// ─── Tus upload initiation ───────────────────────────────────────────────────

/** Response from POST /videos/upload-init — returns the tus endpoint URL. */
export const videoUploadInitSchema = z.object({
  tusEndpoint: z.string(),
  videoId: z.string(),
  maxSizeBytes: z.number(),
});
export type VideoUploadInit = z.infer<typeof videoUploadInitSchema>;

// ─── Video status poll ───────────────────────────────────────────────────────

export const videoStatusResponseSchema = z.object({
  id: z.string(),
  status: videoStatusSchema,
  thumbnailUrl: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});
export type VideoStatusResponse = z.infer<typeof videoStatusResponseSchema>;

// ─── Videos list for a product/review ───────────────────────────────────────

export const videoListSchema = z.object({
  videos: z.array(videoSchema),
});
export type VideoList = z.infer<typeof videoListSchema>;
