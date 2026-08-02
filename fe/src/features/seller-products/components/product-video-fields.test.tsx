import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoUploadState } from "@/features/videos/hooks/useVideoUpload";

const { useVideoUploadMock, useProductVideosMock, uploadMock, cancelMock, retryMock } = vi.hoisted(
  () => ({
    uploadMock: vi.fn(),
    cancelMock: vi.fn(),
    retryMock: vi.fn(),
    useVideoUploadMock: vi.fn(() => ({
      state: {
        phase: "uploading" as VideoUploadState["phase"],
        progress: 42,
        videoId: "uploaded-video-1" as string | null,
        error: null as string | null,
        estimatedDuration: 12 as number | null,
        filename: "demo.mp4" as string | null,
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    })),
    useProductVideosMock: vi.fn(() => ({
      videos: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
  }),
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
        phase: "error" as VideoUploadState["phase"],
        progress: 0,
        videoId: null as string | null,
        error: "video:upload-failed" as string | null,
        estimatedDuration: null as number | null,
        filename: "demo.mp4" as string | null,
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
