import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/auth", () => ({
  getAccessToken: () => null,
  refreshTokens: vi.fn(),
  setLiveTokenSet: vi.fn(),
}));

import { adminListOrdersCursor } from "@/shared/api/endpoints/admin";

const fetchSpy = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchSpy);

function successEnvelope(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: "ok",
      data,
      errorCode: null,
      timestamp: "2026-08-08T00:00:00Z",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("adminListOrdersCursor", () => {
  beforeEach(() => fetchSpy.mockReset());
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses a cursor page and forwards bounded filters without offset parameters", async () => {
    fetchSpy.mockResolvedValueOnce(
      successEnvelope({
        items: [
          {
            orderId: "order-1",
            orderNumber: "VN-1001",
            status: "PAID",
            totalAmount: 125_000,
            itemCount: 1,
            createdAt: "2026-08-07T00:00:00Z",
          },
        ],
        nextCursor: "opaque-next",
        hasMore: true,
        pageSize: 25,
        sort: { field: "createdAt", direction: "desc" },
      }),
    );

    const page = await adminListOrdersCursor({
      q: "VN-1001",
      status: "PAID",
      limit: 25,
      cursor: "opaque-current",
    });

    expect(page).toMatchObject({
      items: [{ orderId: "order-1", orderNumber: "VN-1001", status: "PAID" }],
      nextCursor: "opaque-next",
      hasMore: true,
      pageSize: 25,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "/admin/orders?q=VN-1001&status=PAID&limit=25&cursor=opaque-current",
    );
    expect(fetchSpy.mock.calls[0]?.[0]).not.toMatch(/[?&](page|size)=/);
  });
});
