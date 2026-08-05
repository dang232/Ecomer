import { z } from "zod";

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

export const videoContextSchema = z.enum(["PRODUCT", "REVIEW"]);
export type VideoContext = z.infer<typeof videoContextSchema>;

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

export const videoStatusResponseSchema = z.object({
  id: z.string(),
  status: videoStatusSchema,
  thumbnailUrl: z.string().nullable().optional(),
  playbackUrl: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});
export type VideoStatusResponse = z.infer<typeof videoStatusResponseSchema>;

export const videoListSchema = z.object({
  videos: z.array(videoSchema),
});
export type VideoList = z.infer<typeof videoListSchema>;
