import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UnknownCall = (...args: unknown[]) => unknown;

const myOrdersMock = vi.fn<UnknownCall>();
const orderByIdMock = vi.fn<UnknownCall>();
const cancelOrderMock = vi.fn<UnknownCall>();

vi.mock("@/shared/api/endpoints/orders", () => ({
  myOrders: (...args: unknown[]) => myOrdersMock(...args),
  orderById: (...args: unknown[]) => orderByIdMock(...args),
  cancelOrder: (...args: unknown[]) => cancelOrderMock(...args),
}));

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useCancelOrder, useMyOrders, useOrder } from "./use-orders";

beforeEach(() => {
  myOrdersMock.mockReset();
  orderByIdMock.mockReset();
  cancelOrderMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useMyOrders", () => {
  it("forwards pagination + filter params to myOrders", async () => {
    myOrdersMock.mockResolvedValue({ content: [], totalElements: 0 });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyOrders({ page: 2, size: 10, status: "shipping" }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(myOrdersMock).toHaveBeenCalledWith({ page: 2, size: 10, status: "shipping" });
  });

  it("returns the page envelope verbatim", async () => {
    const page = {
      content: [{ id: "ord-1", status: "DELIVERED", total: 100 }],
      totalElements: 1,
    };
    myOrdersMock.mockResolvedValue(page);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyOrders(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(page);
  });
});

describe("useOrder", () => {
  it("does not call orderById when id is empty", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useOrder(undefined), { wrapper: Wrapper });
    expect(orderByIdMock).not.toHaveBeenCalled();
  });

  it("fetches the detail when id is provided", async () => {
    orderByIdMock.mockResolvedValue({ id: "ord-9", status: "PENDING", total: 200 });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrder("ord-9"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("ord-9"));
    expect(orderByIdMock).toHaveBeenCalledWith("ord-9");
  });
});

describe("useCancelOrder", () => {
  it("invokes cancelOrder with the given id and triggers cache invalidation", async () => {
    cancelOrderMock.mockResolvedValue({ id: "ord-7", status: "CANCELLED", total: 0 });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const cancel = renderHook(() => useCancelOrder(), { wrapper: Wrapper });

    await act(async () => {
      await cancel.result.current.mutateAsync("ord-7");
    });

    expect(cancelOrderMock).toHaveBeenCalledWith("ord-7");
    // Both the list ["orders"] and detail ["orders","detail",id] keys should be invalidated.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["orders"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["orders", "detail", "ord-7"] });
  });

  it("propagates errors from cancelOrder", async () => {
    cancelOrderMock.mockRejectedValue(new Error("backend rejected cancel"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelOrder(), { wrapper: Wrapper });

    let error: unknown = null;
    await act(async () => {
      try {
        await result.current.mutateAsync("ord-bad");
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("backend rejected cancel");
  });
});
