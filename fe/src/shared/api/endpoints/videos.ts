import { api } from "@/shared/api/client";
import { videoListSchema, videoStatusResponseSchema } from "@/shared/contracts/api/video";

export const videoStatus = (videoId: string) =>
  api.get(`/videos/${encodeURIComponent(videoId)}/status`, videoStatusResponseSchema);

export const videosByEntity = (entityId: string, context: "PRODUCT" | "REVIEW") =>
  api.get("/videos", videoListSchema, { entityId, context }, { auth: false });

export const videoDelete = (videoId: string) =>
  api.delete(`/videos/${encodeURIComponent(videoId)}`, videoStatusResponseSchema);
