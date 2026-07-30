/** Tests for P0-9: cancel order confirm dialog on OrdersPage */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { HTMLAttributes, ReactNode, ReactNode as RLNode } from "react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { orderSchema, type Order, type Page } from "@/shared/contracts/api";

// Mock motion/react so AnimatePresence renders synchronously in jsdom
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

const cancelOrderMock = vi.fn();

// vi.hoisted ensures ordersData is shared between mock factory and tests
const { ordersData } = vi.hoisted<{ ordersData: Page<Order> }>(() => ({
  ordersData: {
    content: [],
    totalElements: 0,
    page: 0,
    totalPages: 1,
    first: true,
    last: true,
  },
}));

vi.mock("../hooks/auth-context", () => ({
  useAuth: () => ({ ready: true, authenticated: true, login: vi.fn() }),
}));

vi.mock("../hooks/use-orders", () => ({
  useCancelOrder: () => ({
    mutate: cancelOrderMock,
    isPending: false,
  }),
  myOrdersOptions: vi.fn(() => ({
    // returns queryOptions-like object
    queryKey: ["orders"],
    queryFn: () => Promise.resolve(ordersData),
  })),
  orderDetailOptions: vi.fn((id: string) => ({
    queryKey: ["orders", "detail", id],
    queryFn: () => Promise.resolve(undefined),
    enabled: true,
  })),
}));

vi.mock("../hooks/use-cart", () => ({
  useCart: () => ({ addItemAsync: vi.fn(), isAddingToCart: false }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let value = typeof opts?.defaultValue === "string" ? opts.defaultValue : key;
      for (const [name, replacement] of Object.entries(opts ?? {})) {
        if (name !== "defaultValue") {
          value = value.replaceAll(`{{${name}}}`, String(replacement));
        }
      }
      return value;
    },
    i18n: { resolvedLanguage: "en" },
  }),
}));

vi.mock("@tanstack/react-query", () => {
  // ordersData is defined in vi.hoisted at the top of this module — it is accessible here

  return {
    queryOptions: <T,>(options: T) => options,
    useQuery: vi.fn(() => ({ data: undefined })),
    useMutation: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
    useSuspenseQuery: vi.fn(() => ({ data: ordersData })),
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }: { children: ReactNode }) => children,
  };
});

import { OrdersPage } from "./OrdersPage";

// NOTE: OrdersPage mocks entire @tanstack/react-query, so this local wrapper
// is intentionally kept distinct from the shared helper.
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: RLNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function makePendingOrder(id: string): Order {
  return orderSchema.parse({
    id,
    status: "PENDING",
    subOrders: [
      {
        id: "so-" + id,
        sellerId: "seller-1",
        sellerName: "Test Seller",
        items: [{ productId: "p-1", name: "Product 1", quantity: 1, price: 100000 }],
      },
    ],
    total: 100000,
    createdAt: "2026-06-01T00:00:00Z",
  });
}

describe("OrdersPage — P0-9 cancel confirm dialog", () => {
  beforeEach(() => {
    cancelOrderMock.mockReset();
    ordersData.content = [];
    ordersData.totalElements = 0;
  });

  it("opens the confirm dialog when the cancel button is clicked", async () => {
    ordersData.content = [makePendingOrder("ord-cancel-1")];
    ordersData.totalElements = 1;

    const Wrapper = makeWrapper();
    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
      { wrapper: Wrapper },
    );

    // Order card renders `#${order.id.slice(0, 8).toUpperCase()}` so the test waits for
    // the cancel button to be in the DOM (more reliable than text matching across split text nodes).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /orders.actions.cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /orders.actions.cancel/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Cancel order #ORD-CANC?");
  });

  it("does NOT call cancelOrder until the confirm button in the dialog is clicked", async () => {
    ordersData.content = [makePendingOrder("ord-cancel-2")];
    ordersData.totalElements = 1;

    const Wrapper = makeWrapper();
    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
      { wrapper: Wrapper },
    );

    // Order card renders `#${order.id.slice(0, 8).toUpperCase()}` so the test waits for
    // the cancel button to be in the DOM (more reliable than text matching across split text nodes).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /orders.actions.cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /orders.actions.cancel/i }));
    await screen.findByRole("dialog");

    expect(cancelOrderMock).not.toHaveBeenCalled();

    // The confirm button is the one inside [role="dialog"] with bg-error class.
    const dialog = screen.getByRole("dialog");
    const confirmBtn = within(dialog)
      .getAllByRole("button")
      .find((b) => b.className.includes("bg-error"));
    expect(confirmBtn).toBeTruthy();
    if (!confirmBtn) throw new Error("Cancel confirmation button was not rendered");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelOrderMock.mock.calls.some((args) => args[0] === "ord-cancel-2")).toBe(true);
    });
  });

  it("closes the dialog without calling cancelOrder when the dialog cancel button is clicked", async () => {
    ordersData.content = [makePendingOrder("ord-cancel-3")];
    ordersData.totalElements = 1;

    const Wrapper = makeWrapper();
    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>,
      { wrapper: Wrapper },
    );

    // Order card renders `#${order.id.slice(0, 8).toUpperCase()}` so the test waits for
    // the cancel button to be in the DOM (more reliable than text matching across split text nodes).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /orders.actions.cancel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /orders.actions.cancel/i }));
    await screen.findByRole("dialog");

    // The dialog cancel button is the one inside [role="dialog"] (mock t() returns the key).
    const dialog = screen.getByRole("dialog");
    const dialogCancelBtn = within(dialog).getByRole("button", { name: "common.cancel" });
    fireEvent.click(dialogCancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });
});
