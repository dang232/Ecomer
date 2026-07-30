import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: { post: vi.fn() },
}));

import { api } from "@/shared/api/client";

import { shippingOptions } from "@/shared/api/endpoints/checkout";

describe("shippingOptions", () => {
  it("sends the selected delivery address required by the checkout API", async () => {
    const response = [{ code: "STANDARD", name: "Standard", fee: 30000, estimatedDays: 3 }];
    const address = {
      street: "1 Nguyen Hue",
      ward: "Ben Nghe",
      district: "District 1",
      city: "Ho Chi Minh City",
    };
    vi.mocked(api.post).mockResolvedValue(response);

    await expect(shippingOptions({ address })).resolves.toBe(response);
    expect(api.post).toHaveBeenCalledWith("/checkout/shipping-options", expect.anything(), {
      address,
    });
  });
});
