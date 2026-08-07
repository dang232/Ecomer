import { api } from "@/shared/api/client";
import { videoListSchema, videoStatusResponseSchema } from "@/shared/contracts/api/video";
import { z } from "zod";

export const videoStatus = (videoId: string) =>
  api.get(`/videos/${encodeURIComponent(videoId)}/status`, videoStatusResponseSchema);

export const videosByEntity = (
  entityId: string,
  context: "PRODUCT" | "REVIEW",
  signal?: AbortSignal,
) => api.get("/videos", videoListSchema, { entityId, context }, { auth: false, signal });

export const videoDelete = (videoId: string) =>
  api.delete(`/videos/${encodeURIComponent(videoId)}`, videoStatusResponseSchema);

export const videoCancel = (videoId: string) =>
  api.delete(`/videos/upload/${encodeURIComponent(videoId)}`, z.undefined());
