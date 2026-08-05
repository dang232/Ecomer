import { describe, expect, it, vi } from "vitest";

vi.mock("../client", () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from "../client";

import { adminCompletePayout, adminFailPayout } from "./admin";

describe("admin payout compatibility actions", () => {
  it("sends manual payment reason and evidence to the complete compatibility path", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const body = {
      reason: "Manual transfer verified",
      evidence: {
        externalReference: "BANK-TRANSFER-1",
        evidenceHash: "sha256:abc123",
        maskedDestinationConfirmed: true,
      },
    };

    await adminCompletePayout("payout-1", body);

    expect(api.post).toHaveBeenCalledWith(
      "/admin/finance/payouts/payout-1/complete",
      expect.anything(),
      body,
    );
  });

  it("sends failure reason and optional evidence to the fail compatibility path", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const body = {
      reason: "Provider rejected the transfer",
      evidence: { evidenceHash: "sha256:def456" },
    };

    await adminFailPayout("payout-1", body);

    expect(api.post).toHaveBeenCalledWith(
      "/admin/finance/payouts/payout-1/fail",
      expect.anything(),
      body,
    );
  });
});
