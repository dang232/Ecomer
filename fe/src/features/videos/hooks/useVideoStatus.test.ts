import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mock ───────────────────────────────────────────────────────────────

const videoStatusMock = vi.fn();

vi.mock("../../../app/lib/api/endpoints/videos", () => ({
  videoStatus: (...args: unknown[]) => videoStatusMock(...args),
}));

import { useVideoStatus } from "./useVideoStatus";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return { Wrapper, client };
}

function makeStatusResponse(status: string, overrides: Record<string, unknown> = {}) {
  return {
    videoId: "vid-1",
    status,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  videoStatusMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useVideoStatus", () => {
  it("returns undefined status while loading", async () => {
    videoStatusMock.mockReturnValue(new Promise(() => {})); // never resolves

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    expect(result.current.status).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("returns status when API resolves with PUBLISHED", async () => {
    videoStatusMock.mockResolvedValue(makeStatusResponse("PUBLISHED"));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("PUBLISHED");
    expect(result.current.isStuck).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns status TRANSCODING for a non-terminal in-progress video", async () => {
    videoStatusMock.mockResolvedValue(makeStatusResponse("TRANSCODING"));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("TRANSCODING");
    expect(result.current.isStuck).toBe(false);
  });

  it("returns status REJECTED for a terminal rejected video", async () => {
    videoStatusMock.mockResolvedValue(makeStatusResponse("REJECTED", { rejectionReason: "spam" }));

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("REJECTED");
    expect(result.current.data).toMatchObject({ rejectionReason: "spam" });
    expect(result.current.isStuck).toBe(false);
  });

  it("does not fetch when videoId is null", async () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useVideoStatus(null), { wrapper: Wrapper });

    await new Promise((r) => setTimeout(r, 50));

    expect(videoStatusMock).not.toHaveBeenCalled();
  });

  it("does not fetch when enabled option is false", async () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useVideoStatus("vid-1", { enabled: false }), {
      wrapper: Wrapper,
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(videoStatusMock).not.toHaveBeenCalled();
  });

  it("exposes error when API call fails after retries", async () => {
    const apiError = new Error("network error");
    videoStatusMock.mockRejectedValue(apiError);

    // The hook sets retry:2 internally, so we must wait for all retries to exhaust.
    // React Query sets query.isError = true once retries are done.
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0 },
        mutations: { retry: false },
      },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children);
    }

    const { result } = renderHook(() => useVideoStatus("vid-1"), { wrapper: Wrapper });

    // Wait until React Query marks the query as errored
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 8000 });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.status).toBeUndefined();
  }, 10000);

  it("reports isStuck true after 15 minutes in a non-terminal state", async () => {
    // shouldAdvanceTime lets real time pass so waitFor/promises still resolve
    // while giving us control over Date.now() via setSystemTime.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const startTime = Date.now();

    videoStatusMock.mockResolvedValue(makeStatusResponse("MODERATING"));

    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isStuck).toBe(false);

    // Jump system clock past the 15-minute stuck threshold.
    // isStuck is computed inline during render (Date.now() - pollStartedAt),
    // so we must trigger a re-render after advancing the clock.
    vi.setSystemTime(startTime + 16 * 60 * 1000);
    rerender();

    expect(result.current.isStuck).toBe(true);
  });

  it("reports isStuck false for a terminal FAILED status even after 15 minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const startTime = Date.now();

    videoStatusMock.mockResolvedValue(makeStatusResponse("FAILED"));

    const { Wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useVideoStatus("vid-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.setSystemTime(startTime + 16 * 60 * 1000);
    rerender();

    expect(result.current.isStuck).toBe(false);
    expect(result.current.status).toBe("FAILED");
  });
});
