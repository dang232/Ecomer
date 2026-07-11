import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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

/**
 * After this many minutes in a non-terminal state, the hook reports
 * {@code stuck: true} so the UI can show a "contact support" state instead
 * of silently polling forever (e.g. moderator DLT, manual hold, infra outage).
 */
const STUCK_THRESHOLD_MINUTES = 15;

function isTerminal(status: VideoStatus | undefined): boolean {
  return !!status && TERMINAL_STATUSES.includes(status);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseVideoStatusOptions {
  /** If false, the query is disabled entirely. Useful when videoId is not yet known. */
  enabled?: boolean;
}

export interface UseVideoStatusResult {
  /** Current pipeline status, or undefined while loading. */
  status: VideoStatus | undefined;
  /** Raw response (carries rejectionReason, moderatedBy, etc.) for richer UI. */
  data: import("../../../app/types/api/video").VideoStatusResponse | undefined;
  /** True if the video has been non-terminal for >15 minutes. UI should show "contact support". */
  isStuck: boolean;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Polls GET /videos/:videoId/status until the video reaches a terminal state
 * (PUBLISHED, REJECTED, or FAILED). The refetch interval adapts to the current
 * pipeline stage so we don't hammer the API while transcoding.
 *
 * After 15 minutes in a non-terminal state the hook reports {@code isStuck:
 * true} so the UI can render a clear "this is taking longer than expected"
 * state instead of polling silently forever.
 */
export function useVideoStatus(videoId: string | null, options: UseVideoStatusOptions = {}): UseVideoStatusResult {
  const enabled = options.enabled !== false && !!videoId;

  const query = useQuery({
    queryKey: ["videos", "status", videoId],
    queryFn: () => videoStatus(videoId!),
    enabled,
    retry: 2,
    refetchInterval(q) {
      const status = q.state.data?.status;
      if (!status || isTerminal(status)) return false;
      return POLL_INTERVAL_MS[status] ?? 5_000;
    },
    refetchIntervalInBackground: false,
  });

  // Track how long we've been in a non-terminal state. Resets each time we
  // move to a new non-terminal status (e.g. UPLOADING → TRANSCODING).
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const status = query.data?.status;

  useEffect(() => {
    if (enabled && !isTerminal(status) && pollStartedAt === null) {
      setPollStartedAt(Date.now());
    } else if (isTerminal(status) && pollStartedAt !== null) {
      setPollStartedAt(null);
    }
  }, [enabled, status, pollStartedAt]);

  const isStuck = !!pollStartedAt
    && Date.now() - pollStartedAt > STUCK_THRESHOLD_MINUTES * 60_000
    && !isTerminal(status);

  return {
    status,
    data: query.data,
    isStuck,
    error: query.error,
    isLoading: query.isLoading,
  };
}

