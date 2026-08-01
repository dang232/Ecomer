import type { AdminVideoAppealItem, AdminVideoModerationQueueItem } from "@/shared/contracts/api";

/** UI-facing view of a video in the moderation queue. */
export interface VideoModerationView {
  videoId: string;
  ownerId: string | null;
  productId: string | null;
  reviewId: string | null;
  status: string;
  rejectionReason: string | null;
  posterUrl: string | null;
  durationSeconds: number | null;
  uploaderName: string | null;
  nsfwScore: number | null;
  createdAt: string | null;
}

export function toVideoModerationView(raw: AdminVideoModerationQueueItem): VideoModerationView {
  return {
    videoId: raw.videoId,
    ownerId: raw.ownerId ?? null,
    productId: raw.productId ?? null,
    reviewId: raw.reviewId ?? null,
    status: raw.status,
    rejectionReason: raw.rejectionReason ?? null,
    posterUrl: raw.posterUrl ?? null,
    durationSeconds: raw.durationSeconds ?? null,
    uploaderName: raw.uploaderName ?? null,
    nsfwScore: raw.nsfwScore ?? null,
    createdAt: raw.createdAt ?? null,
  };
}

/** UI-facing view of an appeal-pending video. */
export interface VideoAppealView {
  videoId: string;
  status: string;
  rejectionReason: string | null;
  appealReason: string | null;
  uploaderName: string | null;
  createdAt: string | null;
  posterUrl: string | null;
  presignedUrl: string | null;
  nsfwScore: number | null;
  durationSeconds: number | null;
}

export function toVideoAppealView(raw: AdminVideoAppealItem): VideoAppealView {
  return {
    videoId: raw.videoId,
    status: raw.status,
    rejectionReason: raw.rejectionReason ?? null,
    appealReason: raw.appealReason ?? null,
    uploaderName: raw.uploaderName ?? null,
    createdAt: raw.createdAt ?? null,
    posterUrl: raw.posterUrl ?? null,
    presignedUrl: raw.presignedUrl ?? null,
    nsfwScore: raw.nsfwScore ?? null,
    durationSeconds: raw.durationSeconds ?? null,
  };
}

/**
 * Maps the UI page (1-based) to the backend page (0-based) for the moderation
 * queue. The moderation queue returns a Spring `page` (0-based); Spring's page
 * 0 is the first page. The URL keeps `page=1` as the first visible page to
 * match the rest of the admin surface.
 */
export function moderationUiPageToBackend(uiPage: number): number {
  return Math.max(0, uiPage - 1);
}

/**
 * Maps the UI page (1-based) to the backend page (0-based) for the appeal
 * queue. The appeals endpoint accepts the Spring page directly.
 */
export function appealUiPageToBackend(uiPage: number): number {
  return Math.max(0, uiPage - 1);
}
