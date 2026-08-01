import { queryOptions } from "@tanstack/react-query";

import { adminListSellers } from "@/shared/api/endpoints/admin";

export const adminSellersQueryOptions = (params: { q?: string } = {}) =>
  queryOptions({
    queryKey: ["admin", "sellers", params.q ?? ""],
    queryFn: () => adminListSellers({ q: params.q || undefined }),
    retry: false,
  });
