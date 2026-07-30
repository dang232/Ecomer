import { createQueryOptions } from "@tanstack/react-query";

import { adminListOrders } from "@/shared/api/endpoints/admin";

export const adminOrdersQueryOptions = (params: {
  q?: string;
  status?: string;
  page?: number;
  size?: number;
}) =>
  createQueryOptions({
    queryKey: ["admin", "orders", params.status ?? "", params.q ?? "", params.page ?? 0],
    queryFn: () =>
      adminListOrders({
        status: params.status || undefined,
        q: params.q || undefined,
        // Page 1 in UI → page 0 in endpoint
        page: (params.page ?? 1) - 1,
        size: params.size ?? 50,
      }),
    retry: false,
  });
