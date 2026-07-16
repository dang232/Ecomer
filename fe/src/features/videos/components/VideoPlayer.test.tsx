import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoPlayer } from "./VideoPlayer";

// i18next mock — returns the key so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("VideoPlayer", () => {
  it("renders a loading skeleton when loading prop is true", () => {
    const { container } = render(<VideoPlayer src="http://example.com/video.mp4" loading />);
    // Skeleton has animate-pulse, no <video> element
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders a native video element with the provided src", () => {
    const { container } = render(<VideoPlayer src="http://example.com/video.mp4" />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.src).toBe("http://example.com/video.mp4");
  });

  it("sets the poster attribute when provided", () => {
    const { container } = render(
      <VideoPlayer src="http://example.com/video.mp4" poster="http://example.com/thumb.jpg" />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("poster")).toBe("http://example.com/thumb.jpg");
  });

  it("shows the play overlay button before first play", () => {
    render(<VideoPlayer src="http://example.com/video.mp4" />);
    const playBtn = screen.getByRole("button", { name: "video.player.playAria" });
    expect(playBtn).toBeInTheDocument();
  });

  it("video element has controls attribute for accessibility", () => {
    const { container } = render(<VideoPlayer src="http://example.com/video.mp4" />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toHaveAttribute("controls");
  });

  it("video element has playsInline attribute", () => {
    const { container } = render(<VideoPlayer src="http://example.com/video.mp4" />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video).toHaveAttribute("playsinline");
  });

  it("hides the overlay after play event fires on the video element", () => {
    const { container } = render(<VideoPlayer src="http://example.com/video.mp4" />);
    const video = container.querySelector("video") as HTMLVideoElement;

    // Simulate the video's play event — the component listens via onPlay
    fireEvent.play(video);

    // The play overlay should be gone once playing is true
    expect(screen.queryByRole("button", { name: "video.player.playAria" })).toBeNull();
  });

  it("applies custom className to the wrapper", () => {
    const { container } = render(
      <VideoPlayer src="http://example.com/video.mp4" className="my-custom-class" />,
    );
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("renders without crashing when src is an empty string", () => {
    const { container } = render(<VideoPlayer src="" />);
    expect(container.querySelector("video")).not.toBeNull();
  });
});
