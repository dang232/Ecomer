import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("./use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

const getWishlistMock = vi.fn();
const addWishlistItemMock = vi.fn();
const toggleWishlistItemMock = vi.fn();
const removeWishlistItemMock = vi.fn();
const clearWishlistMock = vi.fn();
vi.mock("../lib/api/endpoints/wishlist", () => ({
  getWishlist: (...args: unknown[]) => getWishlistMock(...args),
  addWishlistItem: (...args: unknown[]) => addWishlistItemMock(...args),
  toggleWishlistItem: (...args: unknown[]) => toggleWishlistItemMock(...args),
  removeWishlistItem: (...args: unknown[]) => removeWishlistItemMock(...args),
  clearWishlist: (...args: unknown[]) => clearWishlistMock(...args),
}));

import { useWishlist } from "./use-wishlist";
import { makeWrapper } from "../test-utils/render-with-query-client";


beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true });
  getWishlistMock.mockReset();
  addWishlistItemMock.mockReset();
  toggleWishlistItemMock.mockReset();
  removeWishlistItemMock.mockReset();
  clearWishlistMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useWishlist", () => {
  it("does not fetch when unauthenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useWishlist(), { wrapper: Wrapper });
    expect(getWishlistMock).not.toHaveBeenCalled();
  });

  it("returns ids from the BE response", async () => {
    getWishlistMock.mockResolvedValue({
      productIds: ["a", "b"],
      items: [{ productId: "a" }, { productId: "b" }],
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useWishlist(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ids).toEqual(["a", "b"]));
    expect(result.current.count).toBe(2);
    expect(result.current.has("a")).toBe(true);
    expect(result.current.has("missing")).toBe(false);
  });

  it("toggle optimistically adds and reconciles with server", async () => {
    getWishlistMock.mockResolvedValue({ productIds: [], items: [] });
    toggleWishlistItemMock.mockResolvedValue({
      productId: "p1",
      changed: true,
      inWishlist: true,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useWishlist(), { wrapper: Wrapper });
    await waitFor(() => expect(getWishlistMock).toHaveBeenCalled());

    await act(async () => {
      const willBeIn = result.current.toggle("p1");
      expect(willBeIn).toBe(true);
    });

    await waitFor(() => expect(result.current.has("p1")).toBe(true));
    expect(toggleWishlistItemMock).toHaveBeenCalledWith("p1");
  });

  it("toggle optimistically removes when item already on the wishlist", async () => {
    getWishlistMock.mockResolvedValue({
      productIds: ["p1"],
      items: [{ productId: "p1" }],
    });
    toggleWishlistItemMock.mockResolvedValue({
      productId: "p1",
      changed: true,
      inWishlist: false,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useWishlist(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.has("p1")).toBe(true));

    await act(async () => {
      const willBeIn = result.current.toggle("p1");
      expect(willBeIn).toBe(false);
    });

    await waitFor(() => expect(result.current.has("p1")).toBe(false));
  });

  it("rolls back optimistic state when toggle fails", async () => {
    getWishlistMock.mockResolvedValue({ productIds: [], items: [] });
    toggleWishlistItemMock.mockRejectedValue(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useWishlist(), { wrapper: Wrapper });
    await waitFor(() => expect(getWishlistMock).toHaveBeenCalled());

    await act(async () => {
      result.current.toggle("p1");
    });

    await waitFor(() => expect(result.current.has("p1")).toBe(false));
  });

  it("clear empties the wishlist optimistically", async () => {
    getWishlistMock.mockResolvedValue({
      productIds: ["a", "b"],
      items: [{ productId: "a" }, { productId: "b" }],
    });
    clearWishlistMock.mockResolvedValue({ removed: 2 });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useWishlist(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.count).toBe(2));

    await act(async () => {
      result.current.clear();
    });

    await waitFor(() => expect(result.current.count).toBe(0));
    expect(clearWishlistMock).toHaveBeenCalledTimes(1);
  });

  it("migrates legacy localStorage entries to the BE on first authenticated load", async () => {
    localStorage.setItem("vnshop:wishlist", JSON.stringify(["x", "y"]));
    getWishlistMock.mockResolvedValue({ productIds: [], items: [] });
    addWishlistItemMock.mockResolvedValue({
      productId: "x",
      changed: true,
      inWishlist: true,
    });
    const { Wrapper } = makeWrapper();
    renderHook(() => useWishlist(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(addWishlistItemMock.mock.calls.map((c) => c[0])).toEqual(["x", "y"]),
    );
    await waitFor(() => expect(localStorage.getItem("vnshop:wishlist")).toBeNull());
  });

  it("does not migrate when localStorage is empty or invalid", async () => {
    localStorage.setItem("vnshop:wishlist", "not-json");
    getWishlistMock.mockResolvedValue({ productIds: [], items: [] });
    const { Wrapper } = makeWrapper();
    renderHook(() => useWishlist(), { wrapper: Wrapper });

    await waitFor(() => expect(getWishlistMock).toHaveBeenCalled());
    expect(addWishlistItemMock).not.toHaveBeenCalled();
  });
});
