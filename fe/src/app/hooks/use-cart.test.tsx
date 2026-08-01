import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { readJsonText } from "../../shared/api/read-json";

import { useCart } from "./use-cart";

vi.mock("@/shared/auth", () => ({
  getAccessToken: () => null,
  setLiveTokenSet: vi.fn(),
  refreshTokens: vi.fn(),
}));

// Mock product endpoint used by guest cart hydration
vi.mock("@/shared/api/endpoints/products", () => ({
  productById: vi.fn().mockResolvedValue(null),
}));

const fetchSpy = vi.spyOn(global, "fetch");

function cartEnvelope(data: unknown, status = 200): Response {
  const cartData = {
    items:
      data && typeof data === "object" && "items" in data
        ? (data as { items: unknown[] }).items
        : [],
    itemCount:
      data && typeof data === "object" && "itemCount" in data
        ? (data as { itemCount: number }).itemCount
        : 0,
    totalAmount:
      data && typeof data === "object" && "totalAmount" in data
        ? (data as { totalAmount: number }).totalAmount
        : 0,
  };
  return new Response(
    JSON.stringify({
      success: true,
      message: "ok",
      data: cartData,
      errorCode: null,
      timestamp: "",
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const useAuthMock = vi.fn<() => { ready: boolean; authenticated: boolean }>();
vi.mock("./auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

let localStorageSetItemSpy: ReturnType<typeof vi.spyOn>;
let localStorageRemoveItemSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy.mockReset();
  localStorage.clear();

  // Spy on localStorage methods
  localStorageSetItemSpy = vi.spyOn(localStorage, "setItem");
  localStorageRemoveItemSpy = vi.spyOn(localStorage, "removeItem");

  useAuthMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useCart", () => {
  describe("Guest cart (not authenticated)", () => {
    it("should return guest items from localStorage", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([
          { productId: "prod-1", quantity: 2 },
          { productId: "prod-2", quantity: 1, variantId: "var-1" },
        ]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isGuest).toBe(true);
      });

      expect(result.current.items).toHaveLength(2);
    });

    it("ignores malformed guest cart storage", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "prod-1", quantity: 0 }]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isGuest).toBe(true));
      expect(result.current.items).toEqual([]);
    });

    it("should add item to guest cart", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.removeItem("vnshop:guest-cart");

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isGuest).toBe(true);
      });

      act(() => {
        result.current.addItem({ productId: "prod-1", quantity: 1 });
      });

      expect(localStorageSetItemSpy).toHaveBeenCalledWith("vnshop:guest-cart", expect.any(String));
    });

    it("should update guest cart item quantity", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "prod-1", quantity: 2 }]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isGuest).toBe(true);
      });

      act(() => {
        result.current.updateItem({ productId: "prod-1", quantity: 5 });
      });

      expect(localStorageSetItemSpy).toHaveBeenCalledWith(
        "vnshop:guest-cart",
        expect.stringContaining("5"),
      );
    });

    it("should remove item from guest cart", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([
          { productId: "prod-1", quantity: 2 },
          { productId: "prod-2", quantity: 1 },
        ]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isGuest).toBe(true);
      });

      act(() => {
        result.current.removeItem("prod-1");
      });

      expect(localStorageSetItemSpy).toHaveBeenCalledWith(
        "vnshop:guest-cart",
        expect.not.stringContaining("prod-1"),
      );
    });

    it("should clear guest cart", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: false });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "prod-1", quantity: 2 }]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isGuest).toBe(true);
      });

      act(() => {
        result.current.clear();
      });

      expect(localStorageRemoveItemSpy).toHaveBeenCalledWith("vnshop:guest-cart");
    });
  });

  describe("Merge functionality (authenticated)", () => {
    it("should expose merge-related state and functions", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockResolvedValueOnce(cartEnvelope({ items: [], itemCount: 0, totalAmount: 0 }));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Verify merge functions are exposed
      expect(result.current.showMergeDialog).toBeDefined();
      expect(result.current.executeMerge).toBeDefined();
      expect(result.current.keepSeparate).toBeDefined();
      expect(result.current.requestMerge).toBeDefined();
      expect(result.current.isMerging).toBeDefined();
      expect(result.current.guestItemCount).toBeDefined();
      expect(result.current.serverItemCount).toBeDefined();
      expect(result.current.hasItemsWithoutVariant).toBeDefined();
    });

    it("should detect items without variant selection", async () => {
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([
          { productId: "prod-1", quantity: 2 }, // No variantId
          { productId: "prod-2", quantity: 1, variantId: "var-1" }, // Has variantId
        ]),
      );

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockResolvedValueOnce(cartEnvelope({ items: [], itemCount: 0, totalAmount: 0 }));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.guestItemCount).toBeGreaterThan(0);
      });

      expect(result.current.hasItemsWithoutVariant).toBe(true);
    });

    it("should not have items without variant when all have variantId", async () => {
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([
          { productId: "prod-1", quantity: 2, variantId: "var-1" },
          { productId: "prod-2", quantity: 1, variantId: "var-2" },
        ]),
      );

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockResolvedValueOnce(cartEnvelope({ items: [], itemCount: 0, totalAmount: 0 }));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.guestItemCount).toBeGreaterThan(0);
      });

      expect(result.current.hasItemsWithoutVariant).toBe(false);
    });

    it("does not auto-merge before the buyer chooses merge or keep separate", async () => {
      const mockCart = {
        items: [{ productId: "prod-1", quantity: 5, price: 100, name: "Server Item" }],
        itemCount: 5,
        totalAmount: 500,
      };

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockImplementation(() => Promise.resolve(cartEnvelope(mockCart)));
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "prod-1", quantity: 2 }]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      // Wait for initial query to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.current.showMergeDialog).toBe(false);

      act(() => result.current.requestMerge());

      expect(result.current.showMergeDialog).toBe(true);

      act(() => result.current.keepSeparate());

      await act(async () => {
        await expect(result.current.executeMerge()).resolves.toBe(false);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("adds the guest quantity to a matching server item only after merge consent", async () => {
      const mockCart = {
        items: [{ productId: "prod-1", quantity: 5, price: 100, name: "Server Item" }],
        itemCount: 5,
        totalAmount: 500,
      };

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      const mergedCart = {
        items: [{ productId: "prod-1", quantity: 7, price: 100, name: "Server Item" }],
        itemCount: 7,
        totalAmount: 700,
      };
      fetchSpy
        .mockResolvedValueOnce(cartEnvelope(mockCart))
        .mockResolvedValueOnce(cartEnvelope(mergedCart));
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([{ productId: "prod-1", quantity: 2 }]),
      );

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      act(() => result.current.requestMerge());

      await act(async () => {
        await expect(result.current.executeMerge()).resolves.toBe(true);
      });

      const postCall = fetchSpy.mock.calls.find(([, request]) => request?.method === "POST");
      if (!postCall) throw new Error("Expected a cart merge request");
      const [, request] = postCall;
      expect(request).toMatchObject({ method: "POST" });
      if (typeof request?.body !== "string") throw new Error("Expected a JSON request body");
      const mergePayload = readJsonText(
        request.body,
        z.object({
          sessionId: z.string(),
          idempotencyKey: z.string(),
          items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
        }),
      );
      expect(mergePayload.sessionId).not.toBe("");
      expect(mergePayload.idempotencyKey).not.toBe("");
      expect(mergePayload.items).toEqual([{ productId: "prod-1", quantity: 2 }]);
      expect(result.current.items).toMatchObject([{ productId: "prod-1", quantity: 7 }]);
      expect(result.current.itemCount).toBe(7);
    });

    it("keeps the guest cart when the atomic merge endpoint fails", async () => {
      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      localStorage.setItem(
        "vnshop:guest-cart",
        JSON.stringify([
          { productId: "prod-1", quantity: 2 },
          { productId: "prod-2", quantity: 1, variantId: "variant-2" },
        ]),
      );
      fetchSpy
        .mockResolvedValueOnce(cartEnvelope({ items: [], itemCount: 0, totalAmount: 0 }))
        .mockResolvedValueOnce(cartEnvelope({}, 500));

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isReady).toBe(true));
      act(() => result.current.requestMerge());

      await act(async () => {
        await expect(result.current.executeMerge()).resolves.toBe(false);
      });

      expect(JSON.parse(localStorage.getItem("vnshop:guest-cart") ?? "[]")).toEqual([
        { productId: "prod-1", quantity: 2 },
        { productId: "prod-2", quantity: 1, variantId: "variant-2" },
      ]);
    });
  });

  describe("Authenticated cart (no guest items)", () => {
    it("should fetch cart from server when authenticated", async () => {
      const mockCart = {
        items: [{ productId: "prod-1", quantity: 1, price: 100, name: "Test Item" }],
        itemCount: 1,
        totalAmount: 100,
      };

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockResolvedValueOnce(cartEnvelope(mockCart));
      localStorage.removeItem("vnshop:guest-cart");

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.current.items).toHaveLength(1);
    });

    it("should add item to server cart when authenticated", async () => {
      const mockCart = {
        items: [{ productId: "prod-1", quantity: 1, price: 100, name: "Test Item" }],
        itemCount: 1,
        totalAmount: 100,
      };
      const newCart = {
        items: [
          { productId: "prod-1", quantity: 1, price: 100, name: "Test Item" },
          { productId: "prod-2", quantity: 2, price: 50, name: "New Item" },
        ],
        itemCount: 3,
        totalAmount: 200,
      };

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy
        .mockResolvedValueOnce(cartEnvelope(mockCart))
        .mockResolvedValueOnce(cartEnvelope(newCart));
      localStorage.removeItem("vnshop:guest-cart");

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      // Wait for query to complete first
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Now call addItem
      act(() => {
        result.current.addItem({ productId: "prod-2", quantity: 2 });
      });

      // Wait for mutation to complete
      await waitFor(
        () => {
          expect(fetchSpy).toHaveBeenCalledTimes(2);
        },
        { timeout: 3000 },
      );
    });

    it("adds to the server while the initial cart read is still pending", async () => {
      const initialCart = { items: [], itemCount: 0, totalAmount: 0 };
      const updatedCart = {
        items: [{ productId: "prod-2", quantity: 1, price: 50, name: "New Item" }],
        itemCount: 1,
        totalAmount: 50,
      };
      let resolveInitialCart!: (response: Response) => void;
      const initialCartPending = new Promise<Response>((resolve) => {
        resolveInitialCart = resolve;
      });

      useAuthMock.mockReturnValue({ ready: true, authenticated: true });
      fetchSpy.mockImplementation((_input, init) => {
        if (!init?.method || init.method === "GET") return initialCartPending;
        return Promise.resolve(cartEnvelope(updatedCart));
      });
      localStorage.removeItem("vnshop:guest-cart");

      const { Wrapper } = makeWrapper();
      const { result } = renderHook(() => useCart(), { wrapper: Wrapper });

      act(() => {
        result.current.addItem({ productId: "prod-2", quantity: 1 });
      });

      await waitFor(() => {
        const postCall = fetchSpy.mock.calls.find(([, request]) => request?.method === "POST");
        expect(postCall).toBeDefined();
      });

      resolveInitialCart(cartEnvelope(initialCart));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    });
  });
});
