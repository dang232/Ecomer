import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "../lib/api";
import {
  adminApproveAppeal,
  adminApproveVideo,
  adminRejectAppeal,
  adminRejectVideo,
  adminVideoAppealsQueue,
  adminVideoModerationQueue,
  adminVideoPreview,
  type AdminVideoModerationQueueParams,
} from "../lib/api/endpoints/admin";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const videoModerationKeys = {
  queue: (params: object) => ["admin", "videos", "moderation-queue", params] as const,
  preview: (videoId: string) => ["admin", "videos", "preview", videoId] as const,
  appeals: () => ["admin", "videos", "appeal-queue"] as const,
};

// ─── Moderation queue ─────────────────────────────────────────────────────────

/** Re-exported so callers (e.g. VideoModeration.tsx) don't need to reach into admin.ts. */
export type VideoModerationQueueParams = AdminVideoModerationQueueParams;

export function useVideoModerationQueue(params: AdminVideoModerationQueueParams = {}) {
  return useQuery({
    queryKey: videoModerationKeys.queue(params),
    queryFn: () => adminVideoModerationQueue(params),
    retry: false,
  });
}

// ─── Video preview (presigned URL + metadata) ─────────────────────────────────

export function useVideoPreview(videoId: string | null) {
  return useQuery({
    queryKey: videoModerationKeys.preview(videoId ?? ""),
    queryFn: () => {
      if (!videoId) throw new Error("A video ID is required for preview");
      return adminVideoPreview(videoId);
    },
    enabled: !!videoId,
    retry: false,
    // Presigned URLs expire; don't cache for long.
    staleTime: 1000 * 60 * 4, // 4 minutes
  });
}

// ─── Approve video ─────────────────────────────────────────────────────────────

export function useApproveVideo() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (videoId: string) => adminApproveVideo(videoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      toast.success(t("admin.videoModeration.approveOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.videoModeration.approveErr")),
  });
}

// ─── Reject video ──────────────────────────────────────────────────────────────

export function useRejectVideo() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ videoId, reason }: { videoId: string; reason: string }) =>
      adminRejectVideo(videoId, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      toast.success(t("admin.videoModeration.rejectOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.videoModeration.rejectErr")),
  });
}

// ─── Appeals ──────────────────────────────────────────────────────────────────

export function useVideoAppeals() {
  return useQuery({
    queryKey: videoModerationKeys.appeals(),
    queryFn: adminVideoAppealsQueue,
    retry: false,
    // BA audit 2026-06-16 P1-14: cache for 5 minutes so switching tabs
    // doesn't re-fetch every time (Linh's documented #1 complaint).
    staleTime: 1000 * 60 * 5,
  });
}

export function useApproveAppeal() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (videoId: string) => adminApproveAppeal(videoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      toast.success(t("admin.videoAppeals.approveOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.videoAppeals.approveErr")),
  });
}

export function useRejectAppeal() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ videoId, reason }: { videoId: string; reason: string }) =>
      adminRejectAppeal(videoId, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "videos"] });
      toast.success(t("admin.videoAppeals.rejectOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.videoAppeals.rejectErr")),
  });
}
