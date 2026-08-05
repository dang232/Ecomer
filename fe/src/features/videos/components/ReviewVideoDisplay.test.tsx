import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Video } from "@/shared/contracts/api/video";

import { ReviewVideoDisplay } from "./ReviewVideoDisplay";

type VideoPlayerMockProps = {
  src: string;
};

type ReviewVideoHookMockResult = {
  video: Video | null;
};

const mockUseReviewVideo = vi.hoisted(() => vi.fn<() => ReviewVideoHookMockResult>());

// i18next mock — returns the key so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useReviewVideo", () => ({
  useReviewVideo: mockUseReviewVideo,
}));

vi.mock("./VideoPlayer", () => ({
  VideoPlayer: ({ src }: VideoPlayerMockProps) => <div data-testid="video-player" data-src={src} />,
}));

function makeVideo(status: Video["status"], overrides: Partial<Video> = {}): Video {
  return {
    id: "vid-1",
    entityId: "review-1",
    context: "REVIEW",
    status,
    ...overrides,
  };
}

describe("ReviewVideoDisplay", () => {
  it("renders nothing when useReviewVideo returns null", () => {
    mockUseReviewVideo.mockReturnValue({ video: null });
    const { container } = render(<ReviewVideoDisplay reviewId="r1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders VideoPlayer when video status is PUBLISHED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: makeVideo("PUBLISHED", {
        playbackUrl: "http://example.com/video.mp4",
        thumbnailUrl: "http://example.com/thumb.jpg",
      }),
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-src",
      "http://example.com/video.mp4",
    );
  });

  it("renders Processing status with role=status when status is TRANSCODING", () => {
    mockUseReviewVideo.mockReturnValue({
      video: makeVideo("TRANSCODING", { playbackUrl: null, thumbnailUrl: null }),
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "video.review.processing");
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders Processing status with role=status when status is MODERATING", () => {
    mockUseReviewVideo.mockReturnValue({
      video: makeVideo("MODERATING", { playbackUrl: null, thumbnailUrl: null }),
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "video.review.processing");
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders unavailable badge with role=img when status is REJECTED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: makeVideo("REJECTED", { playbackUrl: null, thumbnailUrl: null }),
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    const badge = screen.getByRole("img");
    expect(badge).toHaveAttribute("aria-label", "video.review.unavailable");
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders unavailable badge with role=img when status is FAILED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: makeVideo("FAILED", { playbackUrl: null, thumbnailUrl: null }),
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    const badge = screen.getByRole("img");
    expect(badge).toHaveAttribute("aria-label", "video.review.unavailable");
    expect(screen.queryByTestId("video-player")).toBeNull();
  });
});
