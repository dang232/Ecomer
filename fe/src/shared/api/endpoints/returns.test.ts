import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const apiPostMock = vi.fn<(...args: unknown[]) => unknown>();
const apiGetMock = vi.fn<(...args: unknown[]) => unknown>();

vi.mock("@/shared/api/client", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

import {
  requestReturn,
  listReturns,
  getReturn,
  approveReturn,
  rejectReturn,
  completeReturn,
  openDispute,
  listSellerReturns,
  disputeResponseSchema,
  returnResponseSchema,
  RETURN_REASON_VALUES,
  RETURN_STATUS_VALUES,
} from "@/shared/api/endpoints/returns";

describe("returns API", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    apiGetMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("response mappers", () => {
    it("maps ReturnResponse returnId and requestedAt for existing callers", () => {
      expect(
        returnResponseSchema.parse({
          returnId: "ret-1",
          orderId: "order-1",
          subOrderId: 12,
          buyerId: "buyer-1",
          reason: "damaged",
          status: "REQUESTED",
          requestedAt: "2026-07-21T10:00:00Z",
          resolvedAt: null,
        }),
      ).toMatchObject({
        id: "ret-1",
        returnId: "ret-1",
        createdAt: "2026-07-21T10:00:00Z",
        requestedAt: "2026-07-21T10:00:00Z",
      });
    });

    it("uses DisputeResponse for open-dispute responses", () => {
      const disputeResponse = {
        disputeId: "dispute-1",
        returnId: "ret-1",
        buyerReason: "Seller rejected unfairly",
        sellerResponse: null,
        adminResolution: null,
        resolvedBy: null,
        status: "OPEN",
      };

      expect(disputeResponseSchema.parse(disputeResponse)).toMatchObject({
        disputeId: "dispute-1",
        returnId: "ret-1",
        status: "OPEN",
      });
      expect(returnResponseSchema.safeParse(disputeResponse).success).toBe(false);
    });
  });

  describe("requestReturn", () => {
    it("posts to /returns with correct body", async () => {
      const mockReturn = { id: "ret-1", status: "REQUESTED" };
      apiPostMock.mockResolvedValue(mockReturn);

      const result = await requestReturn({
        subOrderId: "sub-123",
        reason: "damaged",
        pickupType: "pickup",
      });

      expect(apiPostMock).toHaveBeenCalledWith("/returns", expect.anything(), {
        subOrderId: "sub-123",
        reason: "damaged",
        pickupType: "pickup",
      });
      expect(result).toEqual(mockReturn);
    });

    it("handles optional evidencePhotos", async () => {
      apiPostMock.mockResolvedValue({ id: "ret-1" });

      await requestReturn({
        subOrderId: "sub-123",
        reason: "damaged",
        evidencePhotos: ["photo1.jpg", "photo2.jpg"],
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/returns",
        expect.anything(),
        expect.objectContaining({
          evidencePhotos: ["photo1.jpg", "photo2.jpg"],
        }),
      );
    });
  });

  describe("listReturns", () => {
    it("gets /returns and returns array", async () => {
      const mockReturns = [
        { id: "ret-1", status: "REQUESTED" },
        { id: "ret-2", status: "APPROVED" },
      ];
      apiGetMock.mockResolvedValue(mockReturns);

      const result = await listReturns();

      expect(apiGetMock).toHaveBeenCalledWith("/returns", expect.anything());
      expect(result).toEqual(mockReturns);
    });
  });

  describe("getReturn", () => {
    it("gets specific return by ID", async () => {
      const mockReturn = { id: "ret-1", status: "REQUESTED" };
      apiGetMock.mockResolvedValue(mockReturn);

      const result = await getReturn("ret-1");

      expect(apiGetMock).toHaveBeenCalledWith("/returns/ret-1", expect.anything());
      expect(result).toEqual(mockReturn);
    });

    it("URL encodes the return ID", async () => {
      apiGetMock.mockResolvedValue({ id: "ret-1" });

      await getReturn("ret-1-with-special-chars!@#");

      expect(apiGetMock).toHaveBeenCalledWith(
        "/returns/ret-1-with-special-chars!%40%23",
        expect.anything(),
      );
    });
  });

  describe("approveReturn", () => {
    it("posts to approve endpoint", async () => {
      const mockReturn = { id: "ret-1", status: "APPROVED" };
      apiPostMock.mockResolvedValue(mockReturn);

      const result = await approveReturn("ret-1");

      expect(apiPostMock).toHaveBeenCalledWith("/returns/ret-1/approve", expect.anything());
      expect(result).toEqual(mockReturn);
    });
  });

  describe("rejectReturn", () => {
    it("posts rejection without a request body", async () => {
      const mockReturn = { id: "ret-1", status: "REJECTED" };
      apiPostMock.mockResolvedValue(mockReturn);

      const result = await rejectReturn("ret-1");

      expect(apiPostMock).toHaveBeenCalledWith("/returns/ret-1/reject", expect.anything());
      expect(result).toEqual(mockReturn);
    });
  });

  describe("completeReturn", () => {
    it("posts to complete endpoint", async () => {
      const mockReturn = { id: "ret-1", status: "COMPLETED" };
      apiPostMock.mockResolvedValue(mockReturn);

      const result = await completeReturn("ret-1");

      expect(apiPostMock).toHaveBeenCalledWith("/returns/ret-1/complete", expect.anything());
      expect(result).toEqual(mockReturn);
    });
  });

  describe("openDispute", () => {
    it("posts dispute with buyer reason", async () => {
      const mockReturn = { id: "ret-1", status: "DISPUTED" };
      apiPostMock.mockResolvedValue(mockReturn);

      const result = await openDispute("ret-1", { buyerReason: "Seller rejected unfairly" });

      expect(apiPostMock).toHaveBeenCalledWith("/returns/ret-1/disputes", expect.anything(), {
        buyerReason: "Seller rejected unfairly",
      });
      expect(result).toEqual(mockReturn);
    });
  });

  describe("listSellerReturns", () => {
    it("gets /seller/returns", async () => {
      const mockReturns = [{ id: "ret-1", status: "REQUESTED" }];
      apiGetMock.mockResolvedValue(mockReturns);

      const result = await listSellerReturns();

      expect(apiGetMock).toHaveBeenCalledWith("/seller/returns", expect.anything());
      expect(result).toEqual(mockReturns);
    });
  });

  describe("constants", () => {
    it("RETURN_REASON_VALUES contains expected reasons", () => {
      expect(RETURN_REASON_VALUES).toContain("damaged");
      expect(RETURN_REASON_VALUES).toContain("wrong_item");
      expect(RETURN_REASON_VALUES).toContain("changed_mind");
      expect(RETURN_REASON_VALUES).toContain("not_as_described");
      expect(RETURN_REASON_VALUES).toContain("other");
    });

    it("RETURN_STATUS_VALUES contains expected statuses", () => {
      expect(RETURN_STATUS_VALUES).toContain("REQUESTED");
      expect(RETURN_STATUS_VALUES).toContain("APPROVED");
      expect(RETURN_STATUS_VALUES).toContain("REJECTED");
      expect(RETURN_STATUS_VALUES).toContain("COMPLETED");
      expect(RETURN_STATUS_VALUES).toContain("DISPUTED");
    });
  });
});
