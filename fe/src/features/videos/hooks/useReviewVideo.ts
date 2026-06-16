import { useQuery } from "@tanstack/react-query";

import { videosByEntity } from "../../../app/lib/api/endpoints/videos";
import type { Video } from "../../../app/types/api/video";

/**
 * Fetches the video attached to a review (at most one per review).
 * Returns null while loading or if the review has no video.
 *
 * P0-8 (BA audit 2026-06-16): also exposes `isError` so consumers can
 * distinguish a failed API call from "review has no video".
 */
export function useReviewVideo(reviewId: string) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["videos", "review", reviewId],
    queryFn: () => videosByEntity(reviewId, "REVIEW"),
    enabled: !!reviewId,
  });

  const video: Video | null = data?.videos?.[0] ?? null;

  return { video, isLoading, isError, refetch };
}
