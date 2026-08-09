import { adminListOrders, adminListOrdersCursor } from "@/shared/api/endpoints/admin";

export const adminOrdersQueryOptions = (params: {
  q?: string;
  status?: string;
  page?: number;
  size?: number;
}) => ({
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

export const adminOrdersCursorQueryOptions = (params: {
  q?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}) => ({
  queryKey: [
    "admin",
    "orders",
    "cursor",
    params.status ?? "",
    params.q ?? "",
    params.cursor ?? null,
    params.limit ?? 50,
  ],
  queryFn: () =>
    adminListOrdersCursor({
      status: params.status || undefined,
      q: params.q || undefined,
      cursor: params.cursor,
      limit: params.limit ?? 50,
    }),
  retry: false,
});
