import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mock ───────────────────────────────────────────────────────────────

const videosByEntityMock = vi.fn();

vi.mock("@/shared/api/endpoints/videos", () => ({
  videosByEntity: (...args: unknown[]) => videosByEntityMock(...args),
}));

import { useProductVideos } from "./useProductVideos";

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

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid-1",
    entityId: "prod-1",
    context: "PRODUCT" as const,
    status: "PUBLISHED" as const,
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  videosByEntityMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useProductVideos", () => {
  it("returns videos array for a product when API resolves with two videos", async () => {
    const video1 = makeVideo({ id: "vid-1" });
    const video2 = makeVideo({ id: "vid-2" });
    videosByEntityMock.mockResolvedValue({ videos: [video1, video2] });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProductVideos("prod-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.videos).toHaveLength(2);
    expect(result.current.videos[0].id).toBe("vid-1");
    expect(result.current.videos[1].id).toBe("vid-2");
    expect(videosByEntityMock).toHaveBeenCalledWith("prod-1", "PRODUCT");
  });

  it("returns empty array when no videos exist for the product", async () => {
    videosByEntityMock.mockResolvedValue({ videos: [] });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProductVideos("prod-1"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.videos).toEqual([]);
  });

  it("does not fetch when productId is empty string", async () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useProductVideos(""), { wrapper: Wrapper });

    // Give React Query a tick to potentially fire
    await new Promise((r) => setTimeout(r, 50));

    expect(videosByEntityMock).not.toHaveBeenCalled();
  });

  it("uses cache key [videos, product, productId]", async () => {
    videosByEntityMock.mockResolvedValue({ videos: [] });

    const { Wrapper, client } = makeWrapper();
    const { result } = renderHook(() => useProductVideos("prod-42"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const cached = client.getQueryData(["videos", "product", "prod-42"]);
    expect(cached).toEqual({ videos: [] });
  });
});
