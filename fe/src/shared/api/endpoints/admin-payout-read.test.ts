import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep this endpoint test at the transport boundary so the envelope and page
// normalization are exercised together with the live sellerName nullability.
vi.mock("@/shared/auth", () => ({
  getAccessToken: () => null,
  refreshTokens: vi.fn(),
  setLiveTokenSet: vi.fn(),
}));

import { adminAllPayouts, adminAllPayoutsCursor } from "@/shared/api/endpoints/admin";

const fetchSpy = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchSpy);

function successEnvelope(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: "ok",
      data,
      errorCode: null,
      timestamp: "2026-08-04T00:00:00Z",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("adminAllPayouts", () => {
  beforeEach(() => fetchSpy.mockReset());
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the live paged payload when sellerName is null", async () => {
    fetchSpy.mockResolvedValueOnce(
      successEnvelope({
        content: [
          {
            payoutId: "160ac657-6bd6-4e81-899d-3c1286cc19b8",
            sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
            sellerName: null,
            amount: 16_182_000,
            status: "COMPLETED",
            createdAt: "2026-05-24T00:00:00Z",
          },
        ],
        page: 0,
        size: 50,
        totalElements: 36,
        totalPages: 1,
      }),
    );

    const page = await adminAllPayouts({ page: 0, size: 50 });

    expect(page).toMatchObject({
      page: 0,
      size: 50,
      totalElements: 36,
      totalPages: 1,
    });
    expect(page.content[0]).toMatchObject({
      id: "160ac657-6bd6-4e81-899d-3c1286cc19b8",
      sellerId: "2fa79e15-2e29-4b94-903e-15cc20fe36dc",
      sellerName: null,
      amount: 16_182_000,
      status: "COMPLETED",
      requestedAt: "2026-05-24T00:00:00Z",
      currency: "VND",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/admin/finance/payouts?page=0&size=50");
  });

  it("parses cursor payloads and sends bounded cursor parameters", async () => {
    fetchSpy.mockResolvedValueOnce(
      successEnvelope({
        items: [],
        nextCursor: "opaque-next",
        hasMore: true,
        pageSize: 25,
        sort: { field: "createdAt,payoutId", direction: "desc" },
      }),
    );

    const page = await adminAllPayoutsCursor({
      status: "PENDING",
      q: "alice",
      limit: 25,
      cursor: "opaque-current",
    });

    expect(page).toMatchObject({
      items: [],
      nextCursor: "opaque-next",
      hasMore: true,
      pageSize: 25,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "/admin/finance/payouts?status=PENDING&q=alice&limit=25&cursor=opaque-current",
    );
  });
});
