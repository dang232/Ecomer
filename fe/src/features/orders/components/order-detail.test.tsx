import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { readJsonText } from "@/shared/api/read-json";
import { orderDetailSchema } from "@/shared/contracts/api/order";
import { formatPrice } from "@/shared/lib";

import { toOrderView, type OrderView } from "../model/order-view";

import { OrderDetail } from "./order-detail";

const localeDetailSchema = z.object({
  orders: z.object({
    detail: z.object({ tax: z.string() }),
  }),
});

function readTaxLabel(locale: "en" | "vi"): string {
  const messages = readJsonText(
    readFileSync(path.resolve("src/app/lib/i18n", `${locale}.json`), "utf8"),
    localeDetailSchema,
  );
  return messages.orders.detail.tax;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string; seller?: string; date?: string; count?: number },
    ) => {
      const dict: Record<string, string> = {
        "orders.orderId": "Order ID",
        "orders.sellerLabel": `Sold by ${options?.seller ?? ""}`,
        "orders.placedAtLong": `Placed ${options?.date ?? ""}`,
        "orders.detail.items": "Items",
        "orders.detail.timeline": "Timeline",
        "orders.detail.totals": "Totals",
        "orders.detail.subtotal": "Subtotal",
        "orders.detail.shipping": "Shipping",
        "orders.detail.discount": "Discount",
        "orders.detail.total": "Total",
        "orders.actions.chat": "Chat",
        "orders.itemQuantity": `${options?.count ?? 0} item(s)`,
      };
      return dict[key] ?? options?.defaultValue ?? key;
    },
    i18n: { language: "en" },
  }),
}));

const order: OrderView = {
  id: "00000000-0000-0000-0000-000000000042",
  orderNumber: "ORD-42",
  placedAt: "2026-08-01T03:04:05Z",
  status: "confirmed",
  sellerGroups: [
    {
      sellerId: "seller-42",
      sellerName: "Seller Forty-Two",
      subOrderId: "42",
      items: [
        {
          id: "42:product-1",
          productId: "product-1",
          name: "Phone Pro",
          quantity: 1,
          totalVnd: 129_000,
          unitPriceVnd: 129_000,
        },
      ],
    },
  ],
  financial: {
    subtotalVnd: 129_000,
    shippingVnd: 0,
    discountVnd: 0,
    taxVnd: 13_000,
    totalVnd: 142_000,
  },
  timeline: [
    {
      id: "current",
      labelKey: "orders.status.confirmed",
      current: true,
    },
  ],
  actions: [],
  paymentMethod: "COD",
  paymentStatus: "PENDING",
  trackingCode: null,
  carrier: null,
};

describe("OrderDetail", () => {
  it("renders a tax row when the order includes tax so the visible breakdown reconciles to total", () => {
    render(
      <MemoryRouter>
        <OrderDetail order={order} onCancel={vi.fn()} onBuyAgain={vi.fn()} />
      </MemoryRouter>,
    );

    const taxLabel = screen.getByText("Tax");
    const totalLabel = screen.getByText("Total");

    expect(taxLabel).toBeInTheDocument();
    expect(taxLabel.nextElementSibling?.textContent).toBe(formatPrice(13_000));
    expect(totalLabel.nextElementSibling?.textContent).toBe(formatPrice(142_000));
  });

  it("renders the tax row from a backend-shaped response through the decoder and view mapper", () => {
    const decoded = orderDetailSchema.parse({
      id: order.id,
      subOrders: [],
      itemsTotal: { amount: 129_000, currency: "VND" },
      shippingTotal: { amount: 0, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      taxTotal: { amount: 13_000, currency: "VND" },
      finalAmount: { amount: 142_000, currency: "VND" },
      paymentStatus: "PENDING",
      paymentMethod: "COD",
    });
    const mapped = toOrderView({ detail: decoded });

    render(
      <MemoryRouter>
        <OrderDetail order={mapped} onCancel={vi.fn()} onBuyAgain={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tax").nextElementSibling?.textContent).toBe(formatPrice(13_000));
    expect(screen.getByText("Total").nextElementSibling?.textContent).toBe(formatPrice(142_000));
  });

  it("does not add a tax row when the normalized tax amount is zero", () => {
    render(
      <MemoryRouter>
        <OrderDetail
          order={{ ...order, financial: { ...order.financial, taxVnd: 0, totalVnd: 129_000 } }}
          onCancel={vi.fn()}
          onBuyAgain={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Tax")).not.toBeInTheDocument();
  });

  it("defines tax labels in both supported locales", () => {
    expect(readTaxLabel("en")).toBe("Tax");
    expect(readTaxLabel("vi")).toBe("Thuế");
  });
});
