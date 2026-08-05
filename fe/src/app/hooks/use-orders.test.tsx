import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { myOrders } from "@/shared/api/endpoints/orders";
import { orderSchema, type Order } from "@/shared/contracts/api";
import { makeWrapper } from "@/shared/test/render-with-query-client";

type UnknownCall = (...args: unknown[]) => unknown;
type OrderPage = Awaited<ReturnType<typeof myOrders>>;

const myOrdersMock = vi.fn<UnknownCall>();
const orderByIdMock = vi.fn<UnknownCall>();
const cancelOrderMock = vi.fn<UnknownCall>();

vi.mock("@/shared/api/endpoints/orders", () => ({
  myOrders: (...args: unknown[]) => myOrdersMock(...args),
  orderById: (...args: unknown[]) => orderByIdMock(...args),
  cancelOrder: (...args: unknown[]) => cancelOrderMock(...args),
}));

import {
  myOrdersOptions,
  orderDetailOptions,
  useCancelOrder,
  useMyOrders,
  useOrder,
} from "./use-orders";

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
  it("keeps the active list on the authoritative cancellation instead of refetching the projection immediately", async () => {
    const staleOrder = orderSchema.parse({
      orderId: "ord-7",
      status: "PENDING",
      totalAmount: 100,
      itemCount: 1,
    });
    const authoritativeOrder = orderSchema.parse({
      id: "ord-7",
      subOrders: [
        {
          subOrderId: 7,
          sellerId: "seller-7",
          fulfillmentStatus: "CANCELLED",
          items: [],
        },
      ],
      itemsTotal: { amount: 100, currency: "VND" },
      shippingTotal: { amount: 0, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      finalAmount: { amount: 100, currency: "VND" },
      paymentStatus: "PENDING",
      paymentMethod: "COD",
    });
    const stalePage: OrderPage = {
      content: [staleOrder],
      totalElements: 1,
      totalPages: 1,
      page: 0,
      number: 0,
      size: 20,
      first: true,
      last: true,
    };

    myOrdersMock.mockResolvedValue(stalePage);
    cancelOrderMock.mockResolvedValue(authoritativeOrder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }

    const orders = renderHook(
      () => ({ list: useMyOrders({ page: 0, size: 20 }), cancel: useCancelOrder() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(orders.result.current.list.data).toEqual(stalePage));

    await act(async () => {
      await orders.result.current.cancel.mutateAsync("ord-7");
    });

    await waitFor(() =>
      expect(orders.result.current.list.data?.content).toEqual([authoritativeOrder]),
    );
    expect(myOrdersMock).toHaveBeenCalledTimes(1);
  });

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
    // Both caches are marked stale without immediately refetching the async projection.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["orders"], refetchType: "none" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["orders", "detail", "ord-7"],
      refetchType: "none",
    });
  });

  it("writes the authoritative cancellation into every cached order-list variant and detail", async () => {
    const staleListOrder = orderSchema.parse({
      orderId: "ord-7",
      status: "PENDING",
      totalAmount: 100,
      itemCount: 1,
    });
    const unrelatedOrder = orderSchema.parse({
      orderId: "ord-8",
      status: "DELIVERED",
      totalAmount: 200,
      itemCount: 1,
    });
    const staleDetail = orderSchema.parse({
      id: "ord-7",
      subOrders: [
        {
          subOrderId: 7,
          sellerId: "seller-7",
          fulfillmentStatus: "PENDING_ACCEPTANCE",
          items: [],
        },
      ],
      itemsTotal: { amount: 100, currency: "VND" },
      shippingTotal: { amount: 0, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      finalAmount: { amount: 100, currency: "VND" },
      paymentStatus: "PENDING",
      paymentMethod: "COD",
    });
    const authoritativeOrder = orderSchema.parse({
      id: "ord-7",
      subOrders: [
        {
          subOrderId: 7,
          sellerId: "seller-7",
          fulfillmentStatus: "CANCELLED",
          items: [],
        },
      ],
      itemsTotal: { amount: 100, currency: "VND" },
      shippingTotal: { amount: 0, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      finalAmount: { amount: 100, currency: "VND" },
      paymentStatus: "PENDING",
      paymentMethod: "COD",
    });
    const firstPage: OrderPage = {
      content: [staleListOrder, unrelatedOrder],
      totalElements: 2,
      totalPages: 2,
      page: 0,
      number: 0,
      size: 20,
      first: true,
      last: false,
    };
    const pendingPage: OrderPage = {
      content: [staleListOrder],
      totalElements: 1,
      totalPages: 1,
      page: 1,
      number: 1,
      size: 20,
      first: false,
      last: true,
    };

    cancelOrderMock.mockResolvedValue(authoritativeOrder);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(myOrdersOptions({ page: 0, size: 20 }).queryKey, firstPage);
    client.setQueryData(
      myOrdersOptions({ page: 1, size: 20, status: "PENDING" }).queryKey,
      pendingPage,
    );
    client.setQueryData(orderDetailOptions("ord-7").queryKey, staleDetail);

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const cancel = renderHook(() => useCancelOrder(), { wrapper: Wrapper });

    await act(async () => {
      await cancel.result.current.mutateAsync("ord-7");
    });

    const cachedFirstPage = client.getQueryData<OrderPage>(
      myOrdersOptions({ page: 0, size: 20 }).queryKey,
    );
    const cachedPendingPage = client.getQueryData<OrderPage>(
      myOrdersOptions({ page: 1, size: 20, status: "PENDING" }).queryKey,
    );
    expect(cachedFirstPage?.content).toEqual([authoritativeOrder, unrelatedOrder]);
    expect(cachedFirstPage).toMatchObject({
      totalElements: 2,
      totalPages: 2,
      page: 0,
      first: true,
    });
    expect(cachedPendingPage?.content).toEqual([authoritativeOrder]);
    expect(cachedPendingPage).toMatchObject({
      totalElements: 1,
      totalPages: 1,
      page: 1,
      last: true,
    });
    expect(client.getQueryData<Order>(orderDetailOptions("ord-7").queryKey)).toEqual(
      authoritativeOrder,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["orders"], refetchType: "none" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["orders", "detail", "ord-7"],
      refetchType: "none",
    });
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
