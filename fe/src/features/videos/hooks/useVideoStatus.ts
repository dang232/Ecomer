import { useQuery } from "@tanstack/react-query";

import { videoStatus } from "../../../app/lib/api/endpoints/videos";
import type { VideoStatus } from "../../../app/types/api/video";

// ─── Poll intervals per pipeline stage ───────────────────────────────────────

const POLL_INTERVAL_MS: Partial<Record<VideoStatus, number>> = {
  UPLOADING: 3_000,
  TRANSCODING: 5_000,
  MODERATING: 5_000,
};

/** Terminal states — stop polling once we reach one of these. */
const TERMINAL_STATUSES: VideoStatus[] = ["PUBLISHED", "REJECTED", "FAILED"];

function isTerminal(status: VideoStatus | undefined): boolean {
  return !!status && TERMINAL_STATUSES.includes(status);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseVideoStatusOptions {
  /** If false, the query is disabled entirely. Useful when videoId is not yet known. */
  enabled?: boolean;
}

/**
 * Polls GET /videos/:videoId/status until the video reaches a terminal state
 * (PUBLISHED, REJECTED, or FAILED). The refetch interval adapts to the current
 * pipeline stage so we don't hammer the API while transcoding.
 */
export function useVideoStatus(videoId: string | null, options: UseVideoStatusOptions = {}) {
  const enabled = options.enabled !== false && !!videoId;

  return useQuery({
    queryKey: ["videos", "status", videoId],
    queryFn: () => videoStatus(videoId!),
    enabled,
    retry: 2,
    refetchInterval(query) {
      const status = query.state.data?.status;
      if (!status || isTerminal(status)) return false;
      return POLL_INTERVAL_MS[status] ?? 5_000;
    },
    refetchIntervalInBackground: false,
  });
}
