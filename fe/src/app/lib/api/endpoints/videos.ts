import {
  videoListSchema,
  videoStatusResponseSchema,
  videoUploadInitSchema,
} from "../../../types/api/video";
import { api } from "../client";

// ─── Upload initiation ───────────────────────────────────────────────────────

export interface VideoUploadInitBody {
  entityId: string;
  context: "PRODUCT" | "REVIEW";
  filename: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
  idempotencyKey: string;
}

/**
 * POST /videos/upload-init
 * Returns the tus endpoint URL and the server-assigned videoId.
 * The client then drives the tus upload directly to the returned endpoint.
 */
export const videoUploadInit = (body: VideoUploadInitBody) =>
  api.post("/videos/upload-init", videoUploadInitSchema, body);

// ─── Status polling ──────────────────────────────────────────────────────────

/**
 * GET /videos/:videoId/status
 * Poll after the tus upload completes to track the processing pipeline.
 */
export const videoStatus = (videoId: string) =>
  api.get(`/videos/${encodeURIComponent(videoId)}/status`, videoStatusResponseSchema);

// ─── Videos for an entity ────────────────────────────────────────────────────

/**
 * GET /videos?entityId=&context=
 * Returns all published (and pending) videos attached to a product or review.
 */
export const videosByEntity = (entityId: string, context: "PRODUCT" | "REVIEW") =>
  api.get("/videos", videoListSchema, { entityId, context }, { auth: false });

// ─── Delete a video ──────────────────────────────────────────────────────────

export const videoDelete = (videoId: string) =>
  api.delete(`/videos/${encodeURIComponent(videoId)}`, videoStatusResponseSchema);
