import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoUploadState } from "@/features/videos";
import type { Video } from "@/shared/contracts/api/video";

type VideoUploadMockValue = {
  state: VideoUploadState;
  upload: (file: File) => void;
  cancel: () => void;
  reset: () => void;
  retry: () => void;
};

type VideoUploadOptions = {
  entityId: string;
  context: "PRODUCT" | "REVIEW";
  onComplete?: (videoId: string) => void;
};

type ProductVideosMockValue = {
  videos: Video[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const {
  useVideoUploadMock,
  useProductVideosMock,
  videoUploadProgressMock,
  videoDeleteMock,
  invalidateQueriesMock,
  toastSuccessMock,
  toastErrorMock,
  confirmMock,
  uploadMock,
  cancelMock,
  retryMock,
} = vi.hoisted(() => {
  const videoUploadProgressMock = vi.fn<(videoId: string) => void>();
  const videoDeleteMock = vi.fn<(videoId: string) => Promise<unknown>>(() =>
    Promise.resolve({
      id: "video-1",
      status: "DELETED",
    }),
  );
  const invalidateQueriesMock = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();
  const confirmMock = vi.fn<(message?: string) => boolean>();
  const uploadMock = vi.fn<(file: File) => void>();
  const cancelMock = vi.fn<() => void>();
  const retryMock = vi.fn<() => void>();
  const useVideoUploadMock = vi.fn<(options: VideoUploadOptions) => VideoUploadMockValue>(() => ({
    state: {
      phase: "uploading",
      progress: 42,
      entityId: "product-42",
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
  const useProductVideosMock = vi.fn<(productId: string) => ProductVideosMockValue>(() => ({
    videos: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }));

  return {
    useVideoUploadMock,
    useProductVideosMock,
    videoUploadProgressMock,
    videoDeleteMock,
    invalidateQueriesMock,
    toastSuccessMock,
    toastErrorMock,
    confirmMock,
    uploadMock,
    cancelMock,
    retryMock,
  };
});

vi.stubGlobal("confirm", confirmMock);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "seller.products.editor.removeVideo": "Remove video",
        "seller.products.editor.videoDeleted": "Video removed",
        "seller.products.editor.videoDeleteErr": "Couldn't remove video",
        "video.seller.deleteConfirm": "Remove this video? This cannot be undone.",
      };
      if (key === "video.seller.sectionTitle") {
        return `Videos (${String(options?.count)}/${String(options?.max)})`;
      }
      return translations[key] ?? key;
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/shared/api/endpoints/videos", () => ({
  videoDelete: videoDeleteMock,
}));

vi.mock("@/features/videos", () => ({
  VideoUploadDropzone: ({
    uploadState,
    onFileSelected,
    onCancel,
    disabled,
  }: {
    uploadState: { phase: string; progress: number };
    onFileSelected: (file: File) => void;
    onCancel: () => void;
    disabled?: boolean;
  }) => (
    <div
      data-testid="video-dropzone"
      data-disabled={disabled ? "true" : "false"}
      data-phase={uploadState.phase}
    >
      <span data-testid="video-progress">{uploadState.progress}</span>
      <button
        type="button"
        onClick={() => onFileSelected(new File(["video"], "demo.mp4", { type: "video/mp4" }))}
      >
        select video
      </button>
      <button type="button" onClick={onCancel}>
        retry or cancel
      </button>
    </div>
  ),
  VideoUploadProgress: ({ videoId }: { videoId: string }) => {
    videoUploadProgressMock(videoId);
    return <div data-testid="video-status" data-video-id={videoId} />;
  },
  useVideoUpload: useVideoUploadMock,
  useProductVideos: useProductVideosMock,
}));

import { ProductVideoFields } from "./product-video-fields";

describe("ProductVideoFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    videoDeleteMock.mockResolvedValue({ id: "video-1", status: "DELETED" });
    invalidateQueriesMock.mockResolvedValue(undefined);
  });

  it("passes the persisted product ID to upload hooks and renders upload/status state", () => {
    render(<ProductVideoFields productId="product-42" />);

    expect(useVideoUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "product-42",
        context: "PRODUCT",
      }),
    );
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
        entityId: "product-42",
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

  it("keeps the status poller mounted after upload completes before the public product video appears", () => {
    useVideoUploadMock
      .mockReturnValueOnce({
        state: {
          phase: "uploading",
          progress: 100,
          entityId: "product-42",
          videoId: "upload-session-id",
          error: null,
          estimatedDuration: 12,
          filename: "demo.mp4",
        },
        upload: uploadMock,
        cancel: cancelMock,
        reset: vi.fn(),
        retry: retryMock,
      })
      .mockReturnValueOnce({
        state: {
          phase: "complete",
          progress: 100,
          entityId: "product-42",
          videoId: null,
          error: null,
          estimatedDuration: 12,
          filename: "demo.mp4",
        },
        upload: uploadMock,
        cancel: cancelMock,
        reset: vi.fn(),
        retry: retryMock,
      });
    useProductVideosMock.mockReturnValue({
      videos: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<ProductVideoFields productId="product-42" />);
    const uploadOptions = useVideoUploadMock.mock.calls[0]?.[0];
    expect(uploadOptions).toMatchObject({
      entityId: "product-42",
      context: "PRODUCT",
    });
    act(() => {
      uploadOptions?.onComplete?.("uploaded-video-1");
    });

    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "uploaded-video-1");

    rerender(<ProductVideoFields productId="product-42" />);

    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "uploaded-video-1");
  });

  it("does not keep product A status mounted after rerendering for product B", () => {
    useVideoUploadMock
      .mockReturnValueOnce({
        state: {
          phase: "complete",
          progress: 100,
          entityId: "product-a",
          videoId: "video-a",
          error: null,
          estimatedDuration: 12,
          filename: "a.mp4",
        },
        upload: uploadMock,
        cancel: cancelMock,
        reset: vi.fn(),
        retry: retryMock,
      })
      .mockReturnValueOnce({
        state: {
          phase: "complete",
          progress: 100,
          videoId: "video-a",
          error: null,
          estimatedDuration: 12,
          filename: "a.mp4",
          entityId: "product-a",
        },
        upload: uploadMock,
        cancel: cancelMock,
        reset: vi.fn(),
        retry: retryMock,
      });
    useProductVideosMock
      .mockReturnValueOnce({
        videos: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        videos: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });

    const { rerender } = render(<ProductVideoFields productId="product-a" />);
    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "video-a");

    rerender(<ProductVideoFields productId="product-b" />);

    expect(screen.queryByTestId("video-status")).toBeNull();
  });

  it("does not render a stale completed latch for product B after product A completes", () => {
    useVideoUploadMock.mockReturnValue({
      state: {
        phase: "complete",
        progress: 100,
        entityId: null,
        videoId: null,
        error: null,
        estimatedDuration: 12,
        filename: "demo.mp4",
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });
    useProductVideosMock.mockReturnValue({
      videos: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(<ProductVideoFields productId="product-a" />);
    const uploadOptions = useVideoUploadMock.mock.calls[0]?.[0];
    expect(uploadOptions).toMatchObject({
      entityId: "product-a",
      context: "PRODUCT",
    });

    act(() => {
      uploadOptions?.onComplete?.("video-a");
    });
    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "video-a");
    expect(videoUploadProgressMock).toHaveBeenLastCalledWith("video-a");

    rerender(<ProductVideoFields productId="product-b" />);

    expect(screen.queryByTestId("video-status")).toBeNull();
    expect(videoUploadProgressMock).toHaveBeenCalledTimes(1);
  });

  it("shows persisted product videos in a three-slot count while upload remains available", () => {
    useVideoUploadMock.mockReturnValueOnce({
      state: {
        phase: "idle",
        progress: 0,
        entityId: null,
        videoId: null,
        error: null,
        estimatedDuration: null,
        filename: null,
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });
    useProductVideosMock.mockReturnValue({
      videos: [
        {
          id: "video-1",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "front-demo.mp4",
        },
        {
          id: "video-2",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "detail-demo.webm",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProductVideoFields productId="product-42" />);

    expect(screen.getByRole("group", { name: "Videos (2/3)" })).toBeInTheDocument();
    expect(screen.getByText("front-demo.mp4")).toBeInTheDocument();
    expect(screen.getByText("detail-demo.webm")).toBeInTheDocument();
    expect(screen.getByTestId("video-dropzone")).toHaveAttribute("data-disabled", "false");
  });

  it("counts a completed upload not yet returned by the product videos query and hides the dropzone at three", () => {
    useVideoUploadMock.mockReturnValue({
      state: {
        phase: "complete",
        progress: 100,
        entityId: null,
        videoId: null,
        error: null,
        estimatedDuration: 12,
        filename: "queued-third.mp4",
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });
    useProductVideosMock.mockReturnValue({
      videos: [
        {
          id: "video-1",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "front-demo.mp4",
        },
        {
          id: "video-2",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "detail-demo.webm",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProductVideoFields productId="product-42" />);
    const uploadOptions = useVideoUploadMock.mock.calls[0]?.[0];
    act(() => {
      uploadOptions?.onComplete?.("uploaded-video-3");
    });

    expect(screen.getByRole("group", { name: "Videos (3/3)" })).toBeInTheDocument();
    expect(screen.queryByTestId("video-dropzone")).toBeNull();
    expect(screen.getByTestId("video-status")).toHaveAttribute("data-video-id", "uploaded-video-3");
  });

  it("removes a published persisted video through the owner delete endpoint and invalidates product videos", async () => {
    useVideoUploadMock.mockReturnValueOnce({
      state: {
        phase: "idle",
        progress: 0,
        entityId: null,
        videoId: null,
        error: null,
        estimatedDuration: null,
        filename: null,
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });
    useProductVideosMock.mockReturnValue({
      videos: [
        {
          id: "video-1",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "front-demo.mp4",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProductVideoFields productId="product-42" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove video" }));

    expect(confirmMock).toHaveBeenCalledWith("Remove this video? This cannot be undone.");
    await waitFor(() => {
      expect(videoDeleteMock).toHaveBeenCalledWith("video-1");
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ["videos", "product", "product-42"],
      });
      expect(toastSuccessMock).toHaveBeenCalledWith("Video removed");
    });
  });

  it("shows the localized error when removing a published video fails", async () => {
    videoDeleteMock.mockRejectedValueOnce(new Error("delete failed"));
    useVideoUploadMock.mockReturnValueOnce({
      state: {
        phase: "idle",
        progress: 0,
        entityId: null,
        videoId: null,
        error: null,
        estimatedDuration: null,
        filename: null,
      },
      upload: uploadMock,
      cancel: cancelMock,
      reset: vi.fn(),
      retry: retryMock,
    });
    useProductVideosMock.mockReturnValue({
      videos: [
        {
          id: "video-1",
          entityId: "product-42",
          context: "PRODUCT",
          status: "PUBLISHED",
          originalFilename: "front-demo.mp4",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProductVideoFields productId="product-42" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove video" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Couldn't remove video");
    });
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
