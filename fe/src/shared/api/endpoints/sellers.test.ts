import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock native-auth BEFORE importing anything that touches the client.
vi.mock("@/shared/auth", () => ({
  getAccessToken: () => null,
  setLiveTokenSet: vi.fn(),
  refreshTokens: vi.fn(),
}));

import { ApiError } from "@/shared/api/envelope";

import { getSeller, listSellers } from "@/shared/api/endpoints/sellers";

const fetchSpy = vi.spyOn(global, "fetch");

function envelope(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ success: true, message: "ok", data, errorCode: null, timestamp: "" }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const SELLER = {
  id: "s1",
  shopName: "TechZone",
  description: "Best tech shop",
  logoUrl: "https://cdn/logo.png",
  bannerUrl: null,
  tier: "PREMIUM",
  joinedAt: "2023-01-15T00:00:00Z",
  ratingAvg: 4.8,
  ratingCount: 320,
  totalProducts: 45,
};

beforeEach(() => {
  fetchSpy.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSeller", () => {
  it("returns a parsed PublicSeller on happy path", async () => {
    fetchSpy.mockResolvedValueOnce(envelope(SELLER));
    const result = await getSeller("s1");
    expect(result.id).toBe("s1");
    expect(result.shopName).toBe("TechZone");
    expect(result.tier).toBe("PREMIUM");
    expect(result.ratingAvg).toBe(4.8);
    expect(result.totalProducts).toBe(45);
  });

  it("throws ApiError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          message: "Not found",
          data: null,
          errorCode: "SELLER_NOT_FOUND",
          timestamp: "",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );
    await expect(getSeller("ghost")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws when payload fails zod validation", async () => {
    // Missing required fields: id, shopName, tier, joinedAt, ratingCount, totalProducts
    fetchSpy.mockResolvedValueOnce(envelope({ id: "s1" }));
    await expect(getSeller("s1")).rejects.toThrow();
  });
});

describe("listSellers", () => {
  it("returns a parsed page on happy path", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({ content: [SELLER], page: 0, size: 12, totalElements: 1, totalPages: 1 }),
    );
    const result = await listSellers({ size: 12 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].shopName).toBe("TechZone");
  });

  it("uses default page=0 and size=12 when no opts provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      envelope({ content: [], page: 0, size: 12, totalElements: 0, totalPages: 0 }),
    );
    await listSellers();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=0");
    expect(calledUrl).toContain("size=12");
  });

  it("throws when content items fail zod validation", async () => {
    // Item missing required fields
    fetchSpy.mockResolvedValueOnce(
      envelope({ content: [{ id: "s1" }], page: 0, size: 12, totalElements: 1, totalPages: 1 }),
    );
    await expect(listSellers()).rejects.toThrow();
  });
});
