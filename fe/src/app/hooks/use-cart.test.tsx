import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const useAuthMock = vi.fn();
vi.mock("./use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

const getCartMock = vi.fn();
const addCartItemMock = vi.fn();
const updateCartItemMock = vi.fn();
const removeCartItemMock = vi.fn();
const clearCartMock = vi.fn();
vi.mock("../lib/api/endpoints/cart", () => ({
  getCart: (...args: unknown[]) => getCartMock(...args),
  addCartItem: (...args: unknown[]) => addCartItemMock(...args),
  updateCartItem: (...args: unknown[]) => updateCartItemMock(...args),
  removeCartItem: (...args: unknown[]) => removeCartItemMock(...args),
  clearCart: (...args: unknown[]) => clearCartMock(...args),
}));

import { makeWrapper } from "../test-utils/render-with-query-client";

import { useCart } from "./use-cart";

beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true });
  getCartMock.mockReset();
  addCartItemMock.mockReset();
  updateCartItemMock.mockReset();
  removeCartItemMock.mockReset();
  clearCartMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCart", () => {
  it("does not fetch the cart while keycloak is initialising", () => {
    useAuthMock.mockReturnValue({ ready: false, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useCart(), { wrapper: Wrapper });
    expect(getCartMock).not.toHaveBeenCalled();
  });

  it("does not fetch when unauthenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useCart(), { wrapper: Wrapper });
    expect(getCartMock).not.toHaveBeenCalled();
  });

  it("fetches the cart and exposes derived totals", async () => {
    getCartMock.mockResolvedValue({
      items: [
        { productId: "p1", price: 100, quantity: 2 },
        { productId: "p2", price: 50, quantity: 3 },
      ],
      totalAmount: 350,
      itemCount: 5,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.itemCount).toBe(5);
    expect(result.current.totalAmount).toBe(350);
  });

  it("falls back to derived totals when the server omits them", async () => {
    getCartMock.mockResolvedValue({
      items: [
        { productId: "p1", price: 100, quantity: 2 },
        { productId: "p2", price: 50, quantity: 1 },
      ],
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.itemCount).toBe(3);
    expect(result.current.totalAmount).toBe(250);
  });

  it("addItem updates the cache directly on success without refetching", async () => {
    getCartMock.mockResolvedValue({ items: [], totalAmount: 0, itemCount: 0 });
    addCartItemMock.mockResolvedValue({
      items: [{ productId: "p1", price: 100, quantity: 1 }],
      itemCount: 1,
      totalAmount: 100,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    // Wait for query to succeed (isReady gate) before attempting mutation
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.addItemAsync({ productId: "p1", quantity: 1 });
    });

    expect(addCartItemMock).toHaveBeenCalledWith({ productId: "p1", quantity: 1 });
    // Cart endpoint shouldn't be re-hit on success — cache was patched directly.
    expect(getCartMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.itemCount).toBe(1));
    expect(result.current.totalAmount).toBe(100);
  });

  it("addItem rolls back to the previous cart when the mutation fails", async () => {
    const initialCart = { items: [], totalAmount: 0, itemCount: 0 };
    getCartMock.mockResolvedValue(initialCart);
    addCartItemMock.mockRejectedValueOnce(new Error("server boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toEqual([]));

    await act(async () => {
      await result.current.addItemAsync({ productId: "p1", quantity: 1 }).catch(() => undefined);
    });

    // Cache restored from snapshot — no extra refetch needed.
    expect(getCartMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.itemCount).toBe(0);
  });

  it("updateItem and removeItem patch the cache from the server response", async () => {
    getCartMock.mockResolvedValue({
      items: [{ productId: "p1", price: 100, quantity: 2 }],
      totalAmount: 200,
      itemCount: 2,
    });
    updateCartItemMock.mockResolvedValue({
      items: [{ productId: "p1", price: 100, quantity: 5 }],
      totalAmount: 500,
      itemCount: 5,
    });
    removeCartItemMock.mockResolvedValue({ items: [], totalAmount: 0, itemCount: 0 });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.itemCount).toBe(2));

    await act(async () => {
      result.current.updateItem({ productId: "p1", quantity: 5 });
    });
    await waitFor(() => expect(result.current.itemCount).toBe(5));
    expect(updateCartItemMock).toHaveBeenCalledWith("p1", { quantity: 5 });

    await act(async () => {
      result.current.removeItem("p1");
    });
    await waitFor(() => expect(result.current.itemCount).toBe(0));
    expect(removeCartItemMock).toHaveBeenCalledWith("p1");
  });

  it("clear sets the cart to an empty shape locally", async () => {
    getCartMock.mockResolvedValue({
      items: [{ productId: "p1", price: 100, quantity: 1 }],
      totalAmount: 100,
      itemCount: 1,
    });
    clearCartMock.mockResolvedValue({});

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.itemCount).toBe(1));

    await act(async () => {
      result.current.clear();
    });

    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(clearCartMock).toHaveBeenCalledTimes(1);
  });
});

describe("useCart (guest mode)", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false });
  });

  it("addItem persists to localStorage and surfaces immediately", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    expect(result.current.isGuest).toBe(true);
    act(() => {
      result.current.addItem({ productId: "p1", quantity: 2 });
    });

    expect(result.current.itemCount).toBe(2);
    expect(addCartItemMock).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem("vnshop:guest-cart") ?? "[]") as {
      productId: string;
      quantity: number;
    }[];
    expect(stored).toEqual([{ productId: "p1", quantity: 2 }]);
  });

  it("addItem on existing product accumulates quantity", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    act(() => {
      result.current.addItem({ productId: "p1", quantity: 1 });
    });
    act(() => {
      result.current.addItem({ productId: "p1", quantity: 3 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.itemCount).toBe(4);
  });

  it("updateItem with quantity<=0 removes the item", () => {
    localStorage.setItem("vnshop:guest-cart", JSON.stringify([{ productId: "p1", quantity: 5 }]));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    expect(result.current.itemCount).toBe(5);
    act(() => {
      result.current.updateItem({ productId: "p1", quantity: 0 });
    });

    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem("vnshop:guest-cart")).toBeNull();
  });

  it("removeItem and clear update localStorage", () => {
    localStorage.setItem(
      "vnshop:guest-cart",
      JSON.stringify([
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 2 },
      ]),
    );
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

    act(() => {
      result.current.removeItem("p1");
    });
    expect(result.current.items.map((i) => i.productId)).toEqual(["p2"]);

    act(() => {
      result.current.clear();
    });
    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem("vnshop:guest-cart")).toBeNull();
  });
});

describe("useCart guest -> server merge", () => {
  it("replays the localStorage cart to the server on first authenticated load", async () => {
    localStorage.setItem(
      "vnshop:guest-cart",
      JSON.stringify([
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ]),
    );
    useAuthMock.mockReturnValue({ ready: true, authenticated: true });
    getCartMock.mockResolvedValue({ items: [], totalAmount: 0, itemCount: 0 });
    addCartItemMock.mockResolvedValue({
      items: [{ productId: "p1", price: 100, quantity: 2 }],
      itemCount: 2,
      totalAmount: 200,
    });
    const { Wrapper } = makeWrapper();
    renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(addCartItemMock).toHaveBeenCalledTimes(2));
    expect(addCartItemMock).toHaveBeenCalledWith({ productId: "p1", quantity: 2 });
    expect(addCartItemMock).toHaveBeenCalledWith({ productId: "p2", quantity: 1 });
    await waitFor(() => expect(localStorage.getItem("vnshop:guest-cart")).toBeNull());
  });

  it("does not run the merge when no localStorage cart exists", async () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: true });
    getCartMock.mockResolvedValue({ items: [], totalAmount: 0, itemCount: 0 });
    const { Wrapper } = makeWrapper();
    renderHook(() => useCart(), { wrapper: Wrapper });

    await waitFor(() => expect(getCartMock).toHaveBeenCalled());
    expect(addCartItemMock).not.toHaveBeenCalled();
  });
});
