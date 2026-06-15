import { useTranslation } from "react-i18next";

import { useReviewVideo } from "../hooks/useReviewVideo";
import { VideoPlayer } from "./VideoPlayer";

interface ReviewVideoDisplayProps {
  reviewId: string;
}

/**
 * Displays a review's attached video (if any) inline.
 * Renders nothing when no video is attached.
 */
export function ReviewVideoDisplay({ reviewId }: ReviewVideoDisplayProps) {
  const { t } = useTranslation();
  const { video } = useReviewVideo(reviewId);

  if (!video) return null;

  if (video.status === "PUBLISHED") {
    return (
      <div className="relative w-16 h-16 rounded-[var(--radius-md)] overflow-hidden shrink-0">
        <VideoPlayer
          src={video.playbackUrl ?? ""}
          poster={video.thumbnailUrl ?? ""}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (video.status !== "REJECTED" && video.status !== "FAILED") {
    return (
      <div className="relative w-16 h-16 rounded-[var(--radius-md)] overflow-hidden shrink-0 bg-muted flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground text-center leading-tight">
          {t("video.review.processing")}
        </span>
      </div>
    );
  }

  return null;
}
