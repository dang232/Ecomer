import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────
const videoUploadInitMock = vi.fn();

vi.mock("../../../app/lib/api/endpoints/videos", () => ({
  videoUploadInit: (...args: unknown[]) => videoUploadInitMock(...args),
}));

// tus-js-client mock
const tusMockInstances: {
  start: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  findPreviousUploads: ReturnType<typeof vi.fn>;
  resumeFromPreviousUpload: ReturnType<typeof vi.fn>;
  options: Record<string, unknown>;
}[] = [];

vi.mock("tus-js-client", () => {
  class Upload {
    options: Record<string, unknown>;
    start = vi.fn();
    abort = vi.fn().mockResolvedValue(undefined);
    findPreviousUploads = vi.fn().mockResolvedValue([]);
    resumeFromPreviousUpload = vi.fn();

    constructor(_file: File, opts: Record<string, unknown>) {
      this.options = opts;
      tusMockInstances.push(this as unknown as (typeof tusMockInstances)[0]);
    }
  }
  return { Upload };
});

import { __testables__, useVideoUpload } from "./useVideoUpload";

const { preflightVideo, MAX_PRODUCT_VIDEO_BYTES, MAX_REVIEW_VIDEO_BYTES } = __testables__;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(opts: { name?: string; type?: string; size?: number } = {}): File {
  const size = opts.size ?? 1024;
  return new File([new Uint8Array(size)], opts.name ?? "demo.mp4", {
    type: opts.type ?? "video/mp4",
  });
}

function renderVideoUploadHook(overrides: Partial<Parameters<typeof useVideoUpload>[0]> = {}) {
  return renderHook(() =>
    useVideoUpload({
      entityId: "prod-1",
      context: "PRODUCT",
      ...overrides,
    }),
  );
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  videoUploadInitMock.mockReset();
  tusMockInstances.length = 0;

  // Stub URL.createObjectURL/revokeObjectURL (used by estimateDuration)
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });

  // Stub document.createElement only for "video" tag — route all other tags to
  // the real implementation so happy-dom's internal DOM wiring stays intact.
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string, ...rest) => {
    if (tag === "video") {
      // Return a minimal stub that immediately fires onloadedmetadata
      const stub = {
        preload: "",
        src: "",
        duration: 42,
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      // Fire the metadata event on next microtask so estimateDuration resolves
      Promise.resolve()
        .then(() => stub.onloadedmetadata?.())
        .catch(() => undefined);
      return stub as unknown as HTMLElement;
    }
    return realCreateElement(tag, ...(rest as []));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ─── preflightVideo ───────────────────────────────────────────────────────────

describe("preflightVideo", () => {
  it("passes for a valid MP4 under the product limit", () => {
    expect(() => preflightVideo(makeFile({ size: 1024 }), "PRODUCT")).not.toThrow();
  });

  it("throws video:empty for a zero-byte file", () => {
    expect(() => preflightVideo(makeFile({ size: 0 }), "PRODUCT")).toThrow("video:empty");
  });

  it("throws video:too-large when product video exceeds 500 MB", () => {
    const huge = makeFile({ size: MAX_PRODUCT_VIDEO_BYTES + 1 });
    expect(() => preflightVideo(huge, "PRODUCT")).toThrow(/video:too-large/);
  });

  it("throws video:too-large when review video exceeds 200 MB", () => {
    const big = makeFile({ size: MAX_REVIEW_VIDEO_BYTES + 1 });
    expect(() => preflightVideo(big, "REVIEW")).toThrow(/video:too-large/);
  });

  it("throws video:wrong-type for an unsupported mime type", () => {
    expect(() =>
      preflightVideo(makeFile({ type: "video/avi", name: "clip.avi" }), "PRODUCT"),
    ).toThrow("video:wrong-type");
  });

  it("throws video:wrong-extension for an unsupported extension", () => {
    expect(() =>
      preflightVideo(makeFile({ name: "clip.avi", type: "video/mp4" }), "PRODUCT"),
    ).toThrow("video:wrong-extension");
  });

  it("accepts .mov files", () => {
    const mov = makeFile({ name: "clip.mov", type: "video/quicktime" });
    expect(() => preflightVideo(mov, "PRODUCT")).not.toThrow();
  });

  it("accepts .webm files", () => {
    const webm = makeFile({ name: "clip.webm", type: "video/webm" });
    expect(() => preflightVideo(webm, "PRODUCT")).not.toThrow();
  });
});

// ─── useVideoUpload ───────────────────────────────────────────────────────────

describe("useVideoUpload", () => {
  it("starts in idle state", () => {
    const { result } = renderVideoUploadHook();
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.progress).toBe(0);
    expect(result.current.state.videoId).toBeNull();
  });

  it("transitions to error state when preflight fails (wrong type)", async () => {
    const onError = vi.fn();
    const { result } = renderVideoUploadHook({ onError });
    const bad = makeFile({ type: "video/avi", name: "clip.avi" });

    await act(async () => {
      await result.current.upload(bad);
    });

    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toBe("video:wrong-type");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "video:wrong-type" }));
    expect(videoUploadInitMock).not.toHaveBeenCalled();
  });

  it("transitions to error state when upload init fails", async () => {
    videoUploadInitMock.mockRejectedValue(new Error("network-error"));
    const onError = vi.fn();
    const { result } = renderVideoUploadHook({ onError });

    await act(async () => {
      await result.current.upload(makeFile());
    });

    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toBe("network-error");
    expect(onError).toHaveBeenCalled();
  }, 10_000);

  it("calls videoUploadInit and starts tus upload on happy path", async () => {
    videoUploadInitMock.mockResolvedValue({
      tusEndpoint: "http://localhost:1080/files/",
      videoId: "vid-abc",
      maxSizeBytes: MAX_PRODUCT_VIDEO_BYTES,
    });

    const onComplete = vi.fn();
    const { result } = renderVideoUploadHook({ onComplete });

    await act(async () => {
      await result.current.upload(makeFile());
    });

    await waitFor(() => expect(tusMockInstances.length).toBeGreaterThan(0));

    const instance = tusMockInstances[0];
    expect(instance.start).toHaveBeenCalled();
    expect(result.current.state.videoId).toBe("vid-abc");

    // Simulate tus onSuccess
    await act(async () => {
      (instance.options.onSuccess as () => void)();
    });

    expect(result.current.state.phase).toBe("complete");
    expect(result.current.state.progress).toBe(100);
    expect(onComplete).toHaveBeenCalledWith("vid-abc");
  }, 10_000);

  it("tracks progress updates from tus onProgress callback", async () => {
    videoUploadInitMock.mockResolvedValue({
      tusEndpoint: "http://localhost:1080/files/",
      videoId: "vid-progress",
      maxSizeBytes: MAX_PRODUCT_VIDEO_BYTES,
    });

    const { result } = renderVideoUploadHook();

    await act(async () => {
      await result.current.upload(makeFile({ size: 10_000 }));
    });

    await waitFor(() => expect(tusMockInstances.length).toBeGreaterThan(0));
    const instance = tusMockInstances[0];

    await act(async () => {
      (instance.options.onProgress as (uploaded: number, total: number) => void)(5_000, 10_000);
    });

    expect(result.current.state.progress).toBe(50);
  }, 10_000);

  it("cancel resets state to idle", async () => {
    videoUploadInitMock.mockResolvedValue({
      tusEndpoint: "http://localhost:1080/files/",
      videoId: "vid-cancel",
      maxSizeBytes: MAX_PRODUCT_VIDEO_BYTES,
    });

    const { result } = renderVideoUploadHook();

    await act(async () => {
      await result.current.upload(makeFile());
    });

    await waitFor(() => expect(tusMockInstances.length).toBeGreaterThan(0));

    await act(async () => {
      result.current.cancel();
    });

    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.videoId).toBeNull();
  }, 10_000);

  it("reuses localStorage resume entry for the same file on second upload call without cancel", async () => {
    videoUploadInitMock.mockResolvedValue({
      tusEndpoint: "http://localhost:1080/files/",
      videoId: "vid-resume",
      maxSizeBytes: MAX_PRODUCT_VIDEO_BYTES,
    });

    const file = makeFile({ name: "big.mp4", size: 2048 });

    // Render two independent hook instances to simulate a page refresh scenario.
    // Both use the same file fingerprint key → same localStorage entry.
    const { result: result1 } = renderVideoUploadHook();

    // First upload seeds localStorage
    await act(async () => {
      await result1.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances.length).toBeGreaterThan(0));
    expect(videoUploadInitMock).toHaveBeenCalledTimes(1);

    // A second independent hook instance (simulating a remount) should reuse the entry
    const { result: result2 } = renderVideoUploadHook();
    await act(async () => {
      await result2.current.upload(file);
    });

    // Init should NOT be called again — cached entry is reused
    expect(videoUploadInitMock).toHaveBeenCalledTimes(1);
  }, 10_000);
});
