import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoUploadState } from "@/features/videos/hooks/useVideoUpload";

type VideoUploadMockValue = {
  state: VideoUploadState;
  upload: (file: File) => void;
  cancel: () => void;
  reset: () => void;
  retry: () => void;
};

const { useVideoUploadMock, useProductVideosMock, uploadMock, cancelMock, retryMock } = vi.hoisted(
  () => {
    const uploadMock = vi.fn<(file: File) => void>();
    const cancelMock = vi.fn<() => void>();
    const retryMock = vi.fn<() => void>();
    const useVideoUploadMock = vi.fn<() => VideoUploadMockValue>(() => ({
      state: {
        phase: "uploading",
        progress: 42,
        videoId: "uploaded-video-1",
        error: null,
        estimatedDuration: 12,
        filename: "demo.mp4",
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    }));
    const useProductVideosMock = vi.fn(() => ({
      videos: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    return { useVideoUploadMock, useProductVideosMock, uploadMock, cancelMock, retryMock };
  },
);

vi.mock("@/features/videos", () => ({
  VideoUploadDropzone: ({
    uploadState,
    onFileSelected,
    onCancel,
  }: {
    uploadState: { phase: string; progress: number };
    onFileSelected: (file: File) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="video-dropzone" data-phase={uploadState.phase}>
      <span data-testid="video-progress">{uploadState.progress}</span>
      <button type="button" onClick={() => onFileSelected(new File(["video"], "demo.mp4"))}>
        select video
      </button>
      <button type="button" onClick={onCancel}>
        retry or cancel
      </button>
    </div>
  ),
  VideoUploadProgress: ({ videoId }: { videoId: string }) => (
    <div data-testid="video-status" data-video-id={videoId} />
  ),
  useVideoUpload: useVideoUploadMock,
  useProductVideos: useProductVideosMock,
}));

import { ProductVideoFields } from "./product-video-fields";

describe("ProductVideoFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the persisted product ID to upload hooks and renders upload/status state", () => {
    render(<ProductVideoFields productId="product-42" />);

    expect(useVideoUploadMock).toHaveBeenCalledWith({
      entityId: "product-42",
      context: "PRODUCT",
    });
    expect(useProductVideosMock).toHaveBeenCalledWith("product-42");
    expect(screen.getByTestId("video-dropzone")).toHaveAttribute("data-phase", "uploading");
    expect(screen.getByTestId("video-progress")).toHaveTextContent("42");
    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "uploaded-video-1");
  });

  it("wires file selection to upload and active cancellation to cancel", () => {
    render(<ProductVideoFields productId="product-42" />);

    fireEvent.click(screen.getByRole("button", { name: "select video" }));
    fireEvent.click(screen.getByRole("button", { name: "retry or cancel" }));

    expect(uploadMock).toHaveBeenCalledWith(expect.any(File));
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(retryMock).not.toHaveBeenCalled();
  });

  it("wires the dropzone retry action when the upload is in an error state", () => {
    useVideoUploadMock.mockReturnValueOnce({
      state: {
        phase: "error",
        progress: 0,
        videoId: null,
        error: "video:upload-failed",
        estimatedDuration: null,
        filename: "demo.mp4",
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });

    render(<ProductVideoFields productId="product-42" />);
    fireEvent.click(screen.getByRole("button", { name: "retry or cancel" }));

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).not.toHaveBeenCalled();
  });
});
