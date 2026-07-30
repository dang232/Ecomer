import { describe, expect, it } from "vitest";

import { ADMIN_QUEUE_CAPABILITIES } from "./queue-capabilities";

describe("ADMIN_QUEUE_CAPABILITIES", () => {
  it("describes controls from current endpoint parameters", () => {
    expect(ADMIN_QUEUE_CAPABILITIES.orders).toEqual({
      search: true,
      status: true,
      sort: [],
      pagination: "server",
      selection: "single",
      actions: {
        cancel: { inputs: {} },
        refund: { inputs: { reason: "required" } },
        "change-status": { inputs: { status: "required" } },
      },
    });
    expect(ADMIN_QUEUE_CAPABILITIES.coupons.pagination).toBe("none");
    expect(ADMIN_QUEUE_CAPABILITIES.payouts.actions.submit.inputs).toEqual({
      providerReference: "required",
      attemptId: "required",
    });
    expect(ADMIN_QUEUE_CAPABILITIES.payouts.actions["legacy-fail"].rules).toEqual([
      {
        kind: "at-least-one",
        fields: ["externalReference", "evidenceHash"],
      },
    ]);
    expect(ADMIN_QUEUE_CAPABILITIES.users).toMatchObject({
      search: true,
      status: false,
      pagination: "server",
    });
  });
});
