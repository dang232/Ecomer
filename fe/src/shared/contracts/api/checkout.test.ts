import { describe, expect, it } from "vitest";

import { calculateCheckoutSchema } from "./checkout";

describe("calculateCheckoutSchema", () => {
  it("preserves the server tax component alongside the authoritative total", () => {
    const calculation = calculateCheckoutSchema.parse({
      itemsTotal: 8_990_000,
      shippingEstimate: 0,
      taxTotal: 899_000,
      discount: 0,
      finalAmount: 9_889_000,
    });

    expect(calculation).toEqual(
      expect.objectContaining({
        subtotal: 8_990_000,
        shippingFee: 0,
        tax: 899_000,
        total: 9_889_000,
      }),
    );
  });
});
