import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLiveTokenSet } from "@/shared/auth/native-auth";

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
      tusMockInstances.push(this);
    }
  }
  return { Upload };
});

import { __testables__, useVideoUpload } from "./useVideoUpload";

const { preflightVideo, MAX_PRODUCT_VIDEO_BYTES, MAX_REVIEW_VIDEO_BYTES } = __testables__;
const NativeURL = URL;
const videoId = "123e4567-e89b-12d3-a456-426614174000";

type TusResponse = {
  getStatus: () => number;
  getHeader: (name: string) => string | undefined;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  return value as Record<string, unknown>;
}

function makeFile(
  opts: { name?: string; type?: string; size?: number; fill?: number; lastModified?: number } = {},
): File {
  const size = opts.size ?? 1024;
  return new File([new Uint8Array(size).fill(opts.fill ?? 0)], opts.name ?? "demo.mp4", {
    type: opts.type ?? "video/mp4",
    lastModified: opts.lastModified,
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

async function receiveCreationLocation(
  instance: (typeof tusMockInstances)[number],
  location = `/videos/upload/${videoId}`,
): Promise<void> {
  const onAfterResponse = instance.options.onAfterResponse;
  expect(onAfterResponse).toBeTypeOf("function");
  await (
    onAfterResponse as (
      request: { getMethod: () => string; getURL: () => string },
      response: TusResponse,
    ) => Promise<void>
  )(
    {
      getMethod: () => "POST",
      getURL: () => "http://localhost:8080/videos/upload",
    },
    {
      getStatus: () => 201,
      getHeader: (name) => (name === "Location" ? location : undefined),
    },
  );
}

beforeEach(() => {
  tusMockInstances.length = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(class extends NativeURL {}, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    }),
  );

  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string, ...rest) => {
    if (tag === "video") {
      const stub = {
        preload: "",
        src: "",
        duration: 42,
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
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
  setLiveTokenSet(null);
  document.cookie = "vnshop_csrf=; Max-Age=0; Path=/";
  localStorage.clear();
});

describe("preflightVideo", () => {
  it("passes for a valid MP4 under the product limit", () => {
    expect(() => preflightVideo(makeFile({ size: 1024 }), "PRODUCT")).not.toThrow();
  });

  it("rejects empty, too-large, wrong-type, and wrong-extension files", () => {
    expect(() => preflightVideo(makeFile({ size: 0 }), "PRODUCT")).toThrow("video:empty");
    expect(() =>
      preflightVideo(makeFile({ size: MAX_PRODUCT_VIDEO_BYTES + 1 }), "PRODUCT"),
    ).toThrow(/video:too-large/);
    expect(() => preflightVideo(makeFile({ size: MAX_REVIEW_VIDEO_BYTES + 1 }), "REVIEW")).toThrow(
      /video:too-large/,
    );
    expect(() =>
      preflightVideo(makeFile({ name: "clip.avi", type: "video/avi" }), "PRODUCT"),
    ).toThrow("video:wrong-type");
    expect(() => preflightVideo(makeFile({ name: "clip.avi" }), "PRODUCT")).toThrow(
      "video:wrong-extension",
    );
  });
});

describe("useVideoUpload", () => {
  it("continues without duration when browser metadata never resolves", async () => {
    vi.useFakeTimers();
    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockImplementation((tag: string) => {
      if (tag === "video") {
        return {
          preload: "",
          src: "",
          duration: Number.NaN,
          onloadedmetadata: null,
          onerror: null,
        } as unknown as HTMLElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    });

    try {
      const promise = __testables__.estimateDuration(makeFile());
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(promise).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts in idle state", () => {
    const { result } = renderVideoUploadHook();
    expect(result.current.state).toMatchObject({
      phase: "idle",
      progress: 0,
      entityId: null,
      videoId: null,
    });
  });

  it("passes the current bearer and CSRF headers to the TUS client", async () => {
    setLiveTokenSet({ accessToken: "access-token", accessExpiresAt: Date.now() + 60_000 });
    document.cookie = "vnshop_csrf=csrf-token; Path=/";
    const { result } = renderVideoUploadHook();

    await act(async () => {
      await result.current.upload(makeFile());
    });

    await waitFor(() => expect(tusMockInstances).toHaveLength(1));
    expect(tusMockInstances[0].options.headers).toEqual({
      Authorization: "Bearer access-token",
      "X-CSRF-Token": "csrf-token",
    });
  });

  it("creates the upload through TUS and derives the video id from the creation Location", async () => {
    const onComplete = vi.fn();
    const file = makeFile();
    const { result } = renderVideoUploadHook({ onComplete });

    await act(async () => {
      await result.current.upload(file);
    });

    await waitFor(() => expect(tusMockInstances).toHaveLength(1));
    const instance = tusMockInstances[0];
    expect(instance.start).toHaveBeenCalledOnce();
    expect(instance.options.endpoint).toBe("http://localhost:8080/videos/upload");
    expect(instance.options.metadata).toMatchObject({
      ownerType: "PRODUCT",
      ownerId: "prod-1",
      filename: file.name,
      filetype: file.type,
    });
    const metadata = asRecord(instance.options.metadata);
    expect(metadata.ownerType).toBe("PRODUCT");
    expect(metadata.ownerId).toBe("prod-1");
    expect(typeof metadata.idempotencyKey).toBe("string");
    expect(result.current.state.videoId).toBeNull();

    await act(async () => {
      await receiveCreationLocation(instance);
    });
    expect(result.current.state.videoId).toBe(videoId);

    act(() => {
      (instance.options.onSuccess as () => void)();
    });

    expect(result.current.state).toMatchObject({
      phase: "complete",
      progress: 100,
      entityId: "prod-1",
      videoId,
    });
    expect(onComplete).toHaveBeenCalledWith(videoId);
  });

  it("stores the server creation URL and resumes it without creating a duplicate upload", async () => {
    const file = makeFile({ name: "big.mp4", size: 2048 });
    const { result: first } = renderVideoUploadHook();

    await act(async () => {
      await first.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));

    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0]);
    });

    const keyPrefix = `vnshop:video-upload-resume:PRODUCT:prod-1:${file.name}:${file.size}:${file.lastModified}:`;
    const key = Object.keys(localStorage).find((entry) => entry.startsWith(keyPrefix));
    expect(key).toBeDefined();
    const persisted = asRecord(JSON.parse(localStorage.getItem(key ?? "") ?? "null"));
    expect(persisted.videoId).toBe(videoId);
    expect(persisted.uploadUrl).toBe(`http://localhost:8080/videos/upload/${videoId}`);
    expect(persisted.filename).toBe(file.name);
    expect(persisted.sizeBytes).toBe(file.size);
    expect(persisted.contentHash).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(typeof persisted.idempotencyKey).toBe("string");

    const { result: second } = renderVideoUploadHook();
    await act(async () => {
      await second.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(2));

    expect(tusMockInstances[1].options.uploadUrl).toBe(
      `http://localhost:8080/videos/upload/${videoId}`,
    );
    expect(tusMockInstances[1].options.endpoint).toBe("http://localhost:8080/videos/upload");
  });

  it("does not resume a failed fixture upload for a different product", async () => {
    const file = makeFile({ name: "shared-fixture.mp4", size: 2048 });
    const { result: first } = renderVideoUploadHook({ entityId: "prod-a" });

    await act(async () => {
      await first.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));

    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0], "/videos/upload/video-a");
    });
    act(() => {
      (tusMockInstances[0].options.onError as (error: Error) => void)(new Error("network-error"));
    });

    const { result: second } = renderVideoUploadHook({ entityId: "prod-b" });
    await act(async () => {
      await second.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(2));

    expect(tusMockInstances[1].options.uploadUrl).toBeNull();
    expect(tusMockInstances[1].options.metadata).toMatchObject({
      ownerType: "PRODUCT",
      ownerId: "prod-b",
    });
  });

  it("starts a fresh same-owner operation after successful completion", async () => {
    const file = makeFile({ name: "repeatable.mp4", size: 2048, lastModified: 123 });
    const { result: first } = renderVideoUploadHook({ entityId: "prod-a" });

    await act(async () => {
      await first.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));
    const firstKey = (tusMockInstances[0].options.metadata as { idempotencyKey: string })
      .idempotencyKey;

    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0], "/videos/upload/video-a");
    });
    expect(tusMockInstances[0].options.removeFingerprintOnSuccess).toBe(true);
    act(() => {
      (tusMockInstances[0].options.onSuccess as () => void)();
    });

    const { result: second } = renderVideoUploadHook({ entityId: "prod-a" });
    await act(async () => {
      await second.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(2));

    expect(tusMockInstances[1].options.uploadUrl).toBeNull();
    expect(
      (tusMockInstances[1].options.metadata as { idempotencyKey: string }).idempotencyKey,
    ).not.toBe(firstKey);
  });

  it("rejects a creation response without a same-origin TUS Location", async () => {
    const { result } = renderVideoUploadHook();
    await act(async () => {
      await result.current.upload(makeFile());
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));

    await expect(
      receiveCreationLocation(
        tusMockInstances[0],
        "https://other.example/videos/upload/foreign-id",
      ),
    ).rejects.toThrow("video:invalid-upload-location");
  });

  it("starts a fresh operation after cancelling a same-owner upload", async () => {
    const file = makeFile({ name: "cancelled.mp4", size: 2048, lastModified: 456 });
    const { result } = renderVideoUploadHook({ entityId: "prod-a" });

    await act(async () => {
      await result.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));
    const firstKey = (tusMockInstances[0].options.metadata as { idempotencyKey: string })
      .idempotencyKey;
    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0], "/videos/upload/video-cancelled");
    });

    act(() => {
      result.current.cancel();
    });

    await act(async () => {
      await result.current.upload(file);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(2));

    expect(tusMockInstances[1].options.uploadUrl).toBeNull();
    expect(
      (tusMockInstances[1].options.metadata as { idempotencyKey: string }).idempotencyKey,
    ).not.toBe(firstKey);
  });

  it("does not collide when same-owner files share metadata but have different content", async () => {
    const firstFile = makeFile({
      name: "same-metadata.mp4",
      size: 2048,
      fill: 0,
      lastModified: 789,
    });
    const secondFile = makeFile({
      name: "same-metadata.mp4",
      size: 2048,
      fill: 1,
      lastModified: 789,
    });
    const { result: first } = renderVideoUploadHook({ entityId: "prod-a" });

    await act(async () => {
      await first.current.upload(firstFile);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));
    const firstKey = (tusMockInstances[0].options.metadata as { idempotencyKey: string })
      .idempotencyKey;
    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0], "/videos/upload/old-content");
    });
    act(() => {
      (tusMockInstances[0].options.onError as (error: Error) => void)(new Error("network-error"));
    });

    const { result: second } = renderVideoUploadHook({ entityId: "prod-a" });
    await act(async () => {
      await second.current.upload(secondFile);
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(2));

    expect(tusMockInstances[1].options.uploadUrl).toBeNull();
    expect(
      (tusMockInstances[1].options.metadata as { idempotencyKey: string }).idempotencyKey,
    ).not.toBe(firstKey);
  });

  it("cancels an active upload and resets state", async () => {
    const { result } = renderVideoUploadHook();
    await act(async () => {
      await result.current.upload(makeFile());
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));

    act(() => {
      result.current.cancel();
    });

    expect(tusMockInstances[0].abort).toHaveBeenCalledWith(true);
    expect(result.current.state).toMatchObject({
      phase: "idle",
      entityId: null,
      videoId: null,
    });
  });

  it("resets stale upload state when the entity id changes", async () => {
    const { result, rerender } = renderHook(
      ({ entityId }) =>
        useVideoUpload({
          entityId,
          context: "PRODUCT",
        }),
      {
        initialProps: { entityId: "prod-a" },
      },
    );

    await act(async () => {
      await result.current.upload(makeFile());
    });
    await waitFor(() => expect(tusMockInstances).toHaveLength(1));

    await act(async () => {
      await receiveCreationLocation(tusMockInstances[0], "/videos/upload/video-a");
    });
    act(() => {
      (tusMockInstances[0].options.onSuccess as () => void)();
    });

    expect(result.current.state).toMatchObject({
      phase: "complete",
      progress: 100,
      entityId: "prod-a",
      videoId: "video-a",
    });

    rerender({ entityId: "prod-b" });

    expect(result.current.state).toMatchObject({
      phase: "idle",
      progress: 0,
      entityId: null,
      videoId: null,
      error: null,
      estimatedDuration: null,
      filename: null,
    });
  });
});
