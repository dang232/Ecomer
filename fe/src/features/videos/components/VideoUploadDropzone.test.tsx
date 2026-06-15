import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VideoUploadDropzone } from "./VideoUploadDropzone";
import type { VideoUploadState } from "../hooks/useVideoUpload";

// i18next mock — returns the key so assertions are key-based
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && Object.keys(opts).length > 0) {
        return `${key}:${JSON.stringify(opts)}`;
      }
      return key;
    },
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const idleState: VideoUploadState = {
  phase: "idle",
  progress: 0,
  videoId: null,
  error: null,
  estimatedDuration: null,
  filename: null,
};

const uploadingState: VideoUploadState = {
  phase: "uploading",
  progress: 42,
  videoId: "vid-123",
  error: null,
  estimatedDuration: null,
  filename: "test.mp4",
};

const errorState: VideoUploadState = {
  phase: "error",
  progress: 0,
  videoId: null,
  error: "video:wrong-type",
  estimatedDuration: null,
  filename: null,
};

const completeState: VideoUploadState = {
  phase: "complete",
  progress: 100,
  videoId: "vid-123",
  error: null,
  estimatedDuration: null,
  filename: "test.mp4",
};

function renderDropzone(
  overrides: Partial<{
    uploadState: VideoUploadState;
    onFileSelected: (f: File) => void;
    onCancel: () => void;
    maxSizeLabel: string;
    disabled: boolean;
  }> = {},
) {
  const props = {
    uploadState: idleState,
    onFileSelected: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<VideoUploadDropzone {...props} />), props };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("VideoUploadDropzone", () => {
  // ── Idle state rendering ───────────────────────────────────────────────────

  it("renders dropzone with upload title text in idle state", () => {
    renderDropzone();
    expect(screen.getByText("video.upload.dropzone.title")).toBeInTheDocument();
  });

  it("renders the hint text with default max size label in idle state", () => {
    renderDropzone();
    // The hint key is rendered with opts injected by the t() mock
    expect(
      screen.getByText(/video\.upload\.dropzone\.hint/),
    ).toBeInTheDocument();
  });

  it("renders a hidden file input accepting video formats", () => {
    const { container } = renderDropzone();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toContain("video/mp4");
  });

  // ── File selection via input ───────────────────────────────────────────────

  it("calls onFileSelected with the chosen file when a valid MP4 is selected via input", () => {
    const onFileSelected = vi.fn();
    const { container } = renderDropzone({ onFileSelected });

    const file = new File(["video"], "test.mp4", { type: "video/mp4" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledOnce();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("calls onFileSelected with the first file when multiple files are provided", () => {
    const onFileSelected = vi.fn();
    const { container } = renderDropzone({ onFileSelected });

    const file1 = new File(["video1"], "test1.mp4", { type: "video/mp4" });
    const file2 = new File(["video2"], "test2.mp4", { type: "video/mp4" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file1, file2] } });

    expect(onFileSelected).toHaveBeenCalledWith(file1);
  });

  it("does not call onFileSelected when file input change has no files", () => {
    const onFileSelected = vi.fn();
    const { container } = renderDropzone({ onFileSelected });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: null } });

    expect(onFileSelected).not.toHaveBeenCalled();
  });

  // ── Disabled state ─────────────────────────────────────────────────────────

  it("does not call onFileSelected when disabled and a file is dropped via input", () => {
    const onFileSelected = vi.fn();
    const { container } = renderDropzone({ onFileSelected, disabled: true });

    const file = new File(["video"], "test.mp4", { type: "video/mp4" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("renders the dropzone button with reduced opacity when disabled", () => {
    const { container } = renderDropzone({ disabled: true });
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzoneBtn.className).toContain("opacity-50");
  });

  it("sets tabIndex to -1 on the dropzone div when disabled", () => {
    const { container } = renderDropzone({ disabled: true });
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzoneBtn.tabIndex).toBe(-1);
  });

  // ── Drag-over visual feedback ──────────────────────────────────────────────

  it("applies drag-over border style when a file is dragged over the dropzone", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;

    fireEvent.dragOver(dropzoneBtn, { preventDefault: () => {} });

    expect(dropzoneBtn.className).toContain("border-primary");
    expect(dropzoneBtn.className).toContain("bg-primary/5");
  });

  it("removes drag-over style when drag leaves the dropzone", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;

    fireEvent.dragOver(dropzoneBtn, { preventDefault: () => {} });
    fireEvent.dragLeave(dropzoneBtn);

    expect(dropzoneBtn.className).not.toContain("bg-primary/5");
  });

  it("does not apply drag-over style when disabled", () => {
    const { container } = renderDropzone({ disabled: true });
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;

    fireEvent.dragOver(dropzoneBtn, { preventDefault: () => {} });

    expect(dropzoneBtn.className).not.toContain("bg-primary/5");
  });

  // ── Drag-and-drop file handling ────────────────────────────────────────────

  it("calls onFileSelected when a file is dropped onto the dropzone", () => {
    const onFileSelected = vi.fn();
    const { container } = renderDropzone({ onFileSelected });
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;

    const file = new File(["video"], "test.mp4", { type: "video/mp4" });
    fireEvent.drop(dropzoneBtn, {
      dataTransfer: { files: [file] },
      preventDefault: () => {},
    });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  // ── Keyboard accessibility ─────────────────────────────────────────────────

  it("is keyboard accessible via Enter key — dropzone has tabIndex 0 when enabled", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzoneBtn.tabIndex).toBe(0);
  });

  it("triggers click on the hidden input when Enter is pressed on the dropzone", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(dropzoneBtn, { key: "Enter" });

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("triggers click on the hidden input when Space is pressed on the dropzone", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(dropzoneBtn, { key: " " });

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("does not trigger click when Enter is pressed and dropzone is disabled", () => {
    const { container } = renderDropzone({ disabled: true });
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(dropzoneBtn, { key: "Enter" });

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("has an aria-label on the dropzone button for screen readers", () => {
    const { container } = renderDropzone();
    const dropzoneBtn = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzoneBtn).toHaveAttribute("aria-label", "video.upload.dropzone.ariaLabel");
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("shows error title when upload state phase is error", () => {
    renderDropzone({ uploadState: errorState });
    expect(screen.getByText("video.upload.dropzone.errorTitle")).toBeInTheDocument();
  });

  it("shows the try-again button when phase is error", () => {
    renderDropzone({ uploadState: errorState });
    expect(screen.getByText("video.upload.dropzone.tryAgain")).toBeInTheDocument();
  });

  it("calls onCancel when the try-again button is clicked in error state", () => {
    const onCancel = vi.fn();
    renderDropzone({ uploadState: errorState, onCancel });

    fireEvent.click(screen.getByText("video.upload.dropzone.tryAgain"));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  // ── Active upload state ────────────────────────────────────────────────────

  it("shows a progress bar when upload is in progress", () => {
    renderDropzone({ uploadState: uploadingState });
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "42");
  });

  it("shows the filename when upload is in progress", () => {
    renderDropzone({ uploadState: uploadingState });
    expect(screen.getByText("test.mp4")).toBeInTheDocument();
  });

  it("shows a cancel button while uploading", () => {
    renderDropzone({ uploadState: uploadingState });
    expect(
      screen.getByRole("button", { name: "video.upload.dropzone.cancelAria" }),
    ).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked during upload", () => {
    const onCancel = vi.fn();
    renderDropzone({ uploadState: uploadingState, onCancel });

    fireEvent.click(
      screen.getByRole("button", { name: "video.upload.dropzone.cancelAria" }),
    );

    expect(onCancel).toHaveBeenCalledOnce();
  });

  // ── Complete state ─────────────────────────────────────────────────────────

  it("shows complete text and hides progress bar when upload is complete", () => {
    renderDropzone({ uploadState: completeState });
    expect(screen.getByText("video.upload.dropzone.complete")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("does not show cancel button when upload is complete", () => {
    renderDropzone({ uploadState: completeState });
    expect(
      screen.queryByRole("button", { name: "video.upload.dropzone.cancelAria" }),
    ).toBeNull();
  });

  it("shows the processing note when upload is complete and videoId is present", () => {
    renderDropzone({ uploadState: completeState });
    expect(
      screen.getByText("video.upload.dropzone.processingNote"),
    ).toBeInTheDocument();
  });
});
