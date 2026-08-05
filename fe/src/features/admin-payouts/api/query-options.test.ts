import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminAllPayouts } = vi.hoisted(() => ({
  adminAllPayouts: vi.fn(),
}));

vi.mock("@/shared/api/endpoints/admin", () => ({
  adminAllPayouts,
}));

import { adminPayoutsQueryOptions } from "./query-options";

describe("adminPayoutsQueryOptions", () => {
  beforeEach(() => {
    adminAllPayouts.mockResolvedValue({ content: [] });
  });

  it("forwards the search term to the server read contract", async () => {
    const options = adminPayoutsQueryOptions({
      status: "PENDING",
      q: "alice-shop",
      page: 1,
      size: 25,
    });

    await options.queryFn?.({} as never);

    expect(adminAllPayouts).toHaveBeenCalledWith({
      status: "PENDING",
      q: "alice-shop",
      page: 1,
      size: 25,
    });
  });
});
