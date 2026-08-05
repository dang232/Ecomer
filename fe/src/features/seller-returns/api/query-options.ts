import type { QueryKey } from "@tanstack/react-query";

/** TanStack Query key factory for seller return queries. */
export const sellerReturnKeys = {
  all: ["seller", "returns"] as const satisfies QueryKey,
};
