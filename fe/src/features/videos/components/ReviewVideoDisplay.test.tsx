import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewVideoDisplay } from "./ReviewVideoDisplay";

// i18next mock — returns the key so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useReviewVideo", () => ({
  useReviewVideo: vi.fn(),
}));

vi.mock("./VideoPlayer", () => ({
  VideoPlayer: (props: any) => <div data-testid="video-player" data-src={props.src} />,
}));

import { useReviewVideo } from "../hooks/useReviewVideo";

const mockUseReviewVideo = useReviewVideo as ReturnType<typeof vi.fn>;

describe("ReviewVideoDisplay", () => {
  it("renders nothing when useReviewVideo returns null", () => {
    mockUseReviewVideo.mockReturnValue({ video: null });
    const { container } = render(<ReviewVideoDisplay reviewId="r1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders VideoPlayer when video status is PUBLISHED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: {
        status: "PUBLISHED",
        playbackUrl: "http://example.com/video.mp4",
        thumbnailUrl: "http://example.com/thumb.jpg",
      },
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    expect(screen.getByTestId("video-player")).toHaveAttribute(
      "data-src",
      "http://example.com/video.mp4",
    );
  });

  it("renders Processing label when status is TRANSCODING", () => {
    mockUseReviewVideo.mockReturnValue({
      video: { status: "TRANSCODING", playbackUrl: null, thumbnailUrl: null },
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByText("video.review.processing")).toBeInTheDocument();
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders Processing label when status is MODERATING", () => {
    mockUseReviewVideo.mockReturnValue({
      video: { status: "MODERATING", playbackUrl: null, thumbnailUrl: null },
    });
    render(<ReviewVideoDisplay reviewId="r1" />);
    expect(screen.getByText("video.review.processing")).toBeInTheDocument();
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("renders nothing when status is REJECTED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: { status: "REJECTED", playbackUrl: null, thumbnailUrl: null },
    });
    const { container } = render(<ReviewVideoDisplay reviewId="r1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when status is FAILED", () => {
    mockUseReviewVideo.mockReturnValue({
      video: { status: "FAILED", playbackUrl: null, thumbnailUrl: null },
    });
    const { container } = render(<ReviewVideoDisplay reviewId="r1" />);
    expect(container.firstChild).toBeNull();
  });
});
