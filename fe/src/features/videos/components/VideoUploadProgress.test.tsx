import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VideoStatusResponse } from "@/shared/contracts/api/video";
import type { UseVideoStatusResult } from "../hooks/useVideoStatus";
import { useVideoStatus } from "../hooks/useVideoStatus";

import { VideoUploadProgress } from "./VideoUploadProgress";

// i18next mock — returns the key so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "reason" in opts) return `${key}:${opts.reason}`;
      return key;
    },
  }),
}));

vi.mock("../hooks/useVideoStatus", () => ({
  useVideoStatus: vi.fn(),
}));

// Use the mocked version
const mockUseVideoStatus = vi.mocked(useVideoStatus);

function makeStatus(overrides: Partial<UseVideoStatusResult> = {}): UseVideoStatusResult {
  return {
    status: undefined,
    data: undefined,
    isStuck: false,
    error: null,
    isLoading: false,
    ...overrides,
  };
}

describe("VideoUploadProgress", () => {
  it("renders pipeline steps for UPLOADING status with first step highlighted", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "UPLOADING" }));

    render(<VideoUploadProgress videoId="vid-1" />);

    // Title shows processing state
    expect(screen.getByText("video.pipeline.processingTitle")).toBeInTheDocument();

    // The UPLOADING step should show "in progress" label
    expect(screen.getByText("video.pipeline.inProgress")).toBeInTheDocument();

    // All four step labels are rendered
    expect(screen.getByText("video.pipeline.uploading")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.transcoding")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.moderating")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.published")).toBeInTheDocument();
  });

  it("renders pipeline steps for TRANSCODING status with second step highlighted", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "TRANSCODING" }));

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.processingTitle")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.inProgress")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.transcoding")).toBeInTheDocument();
  });

  it("renders pipeline steps for MODERATING status with third step highlighted", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "MODERATING" }));

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.processingTitle")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.inProgress")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.moderating")).toBeInTheDocument();
  });

  it("shows completion state title for PUBLISHED status", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "PUBLISHED" }));

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.doneTitle")).toBeInTheDocument();
    // No in-progress spinner when complete
    expect(screen.queryByText("video.pipeline.inProgress")).toBeNull();
  });

  it("shows rejection reason when status is REJECTED with rejectionReason", () => {
    mockUseVideoStatus.mockReturnValue(
      makeStatus({
        status: "REJECTED",
        data: {
          status: "REJECTED",
          rejectionReason: "Inappropriate content",
        } as VideoStatusResponse,
      }),
    );

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.errorTitle")).toBeInTheDocument();
    expect(
      screen.getByText("video.pipeline.rejectionReason:Inappropriate content"),
    ).toBeInTheDocument();
  });

  it("does not show rejection reason when status is REJECTED but rejectionReason is absent", () => {
    mockUseVideoStatus.mockReturnValue(
      makeStatus({
        status: "REJECTED",
        data: {
          status: "REJECTED",
        } as VideoStatusResponse,
      }),
    );

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.errorTitle")).toBeInTheDocument();
    expect(screen.queryByText(/video\.pipeline\.rejectionReason/)).toBeNull();
  });

  it("shows stuck message when isStuck is true", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "TRANSCODING", isStuck: true }));

    render(<VideoUploadProgress videoId="vid-1" />);

    expect(screen.getByText("video.pipeline.stuckTitle")).toBeInTheDocument();
    expect(screen.getByText("video.pipeline.stuckMessage")).toBeInTheDocument();
  });

  it("renders loading state when isLoading is true", () => {
    mockUseVideoStatus.mockReturnValue(makeStatus({ status: "UPLOADING", isLoading: true }));

    const { container } = render(<VideoUploadProgress videoId="vid-1" />);

    // Active step shows a spinning loader icon
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
