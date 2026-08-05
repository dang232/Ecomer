import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn<(path: string, schema: unknown, body?: unknown) => Promise<unknown>>();

vi.mock("@/shared/api/client", () => ({
  api: {
    post: (path: string, schema: unknown, body?: unknown) => postMock(path, schema, body),
  },
}));

import { registerSeller } from "@/shared/api/endpoints/users";
import { sellerProfileSchema } from "@/shared/contracts/api";

const SELLER_PROFILE = {
  id: "seller-1",
  shopName: "Moc Shop",
  bankName: "Vietcombank",
  approved: false,
  tier: "STANDARD",
  vacationMode: false,
  destination: null,
};

beforeEach(() => postMock.mockReset());

describe("registerSeller", () => {
  it("posts the seller registration request and parses SellerProfileResponse", async () => {
    postMock.mockResolvedValueOnce(SELLER_PROFILE);

    const result = await registerSeller({ shopName: "Moc Shop", bankName: "Vietcombank" });

    expect(postMock).toHaveBeenCalledWith("/sellers/register", sellerProfileSchema, {
      shopName: "Moc Shop",
      bankName: "Vietcombank",
    });
    expect(result).toEqual(SELLER_PROFILE);
  });
});
