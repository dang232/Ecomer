import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { videosByEntity as videosByEntityEndpoint } from "@/shared/api/endpoints/videos";
import type { Video } from "@/shared/contracts/api/video";

// ── Module mock ───────────────────────────────────────────────────────────────

const { videosByEntityMock } = vi.hoisted(() => ({
  videosByEntityMock: vi.fn<typeof videosByEntityEndpoint>(),
}));

vi.mock("@/shared/api/endpoints/videos", () => ({
  videosByEntity: videosByEntityMock,
}));

import { useReviewVideo } from "./useReviewVideo";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return { Wrapper };
}

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: "vid-1",
    entityId: "review-1",
    context: "REVIEW" as const,
    status: "PUBLISHED" as const,
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  videosByEntityMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useReviewVideo", () => {
  it("returns single video for a review when API resolves with one video", async () => {
    const video = makeVideo({ id: "vid-review-1" });
    videosByEntityMock.mockResolvedValue({ videos: [video] });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useReviewVideo("review-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.video).not.toBeNull();
    expect(result.current.video?.id).toBe("vid-review-1");
    expect(videosByEntityMock).toHaveBeenCalledWith("review-1", "REVIEW");
  });

  it("returns null when no video is attached to the review", async () => {
    videosByEntityMock.mockResolvedValue({ videos: [] });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useReviewVideo("review-2"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.video).toBeNull();
  });

  it("does not fetch when reviewId is empty string", async () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useReviewVideo(""), { wrapper: Wrapper });

    // Give React Query a tick to potentially fire
    await new Promise((r) => setTimeout(r, 50));

    expect(videosByEntityMock).not.toHaveBeenCalled();
  });
});
