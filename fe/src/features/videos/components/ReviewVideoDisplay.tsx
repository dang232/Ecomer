import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2 } from "lucide-react";

import { useReviewVideo } from "../hooks/useReviewVideo";
import { VideoPlayer } from "./VideoPlayer";

interface ReviewVideoDisplayProps {
  reviewId: string;
}

/**
 * Displays a review's attached video (if any) inline.
 * Renders nothing when no video is attached.
 *
 * BA audit 2026-06-16 fixes:
 * - P1-4: thumbnail size 64px → 96px (mobile-usable)
 * - P1-5: replace unreadable 10px "Processing..." text with a spinner
 * - P1-7: render a "Video unavailable" badge for REJECTED/FAILED instead
 *   of silently returning null
 */
export function ReviewVideoDisplay({ reviewId }: ReviewVideoDisplayProps) {
  const { t } = useTranslation();
  const { video } = useReviewVideo(reviewId);

  if (!video) return null;

  if (video.status === "PUBLISHED") {
    return (
      <div
        className="relative w-24 h-24 rounded-[var(--radius-md)] overflow-hidden shrink-0"
        aria-label={t("video.review.containerLabel")}
      >
        <VideoPlayer
          src={video.playbackUrl ?? ""}
          poster={video.thumbnailUrl ?? ""}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (video.status === "REJECTED" || video.status === "FAILED") {
    return (
      <div
        className="relative w-24 h-24 rounded-[var(--radius-md)] overflow-hidden shrink-0 bg-muted flex flex-col items-center justify-center gap-1 p-1"
        role="img"
        aria-label={t("video.review.unavailable")}
      >
        <AlertCircle size={18} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-[9px] text-muted-foreground text-center leading-tight">
          {t("video.review.unavailable")}
        </span>
      </div>
    );
  }

  // TRANSCODING / MODERATING / PENDING
  return (
    <div
      className="relative w-24 h-24 rounded-[var(--radius-md)] overflow-hidden shrink-0 bg-muted flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={t("video.review.processing")}
    >
      <Loader2 size={20} className="text-muted-foreground animate-spin" aria-hidden="true" />
    </div>
  );
}
