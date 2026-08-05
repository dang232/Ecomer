import { queryOptions } from "@tanstack/react-query";

import { adminAllPayouts } from "@/shared/api/endpoints/admin";

export const adminPayoutsQueryOptions = (params: {
  status?: string;
  page?: number;
  size?: number;
  q?: string;
}) =>
  queryOptions({
    queryKey: [
      "admin",
      "payouts",
      "v5",
      params.status ?? "",
      params.q ?? "",
      params.page ?? 0,
      params.size ?? 50,
    ],
    queryFn: () =>
      adminAllPayouts({
        status: params.status || undefined,
        q: params.q || undefined,
        page: params.page ?? 0,
        size: params.size ?? 50,
      }),
    retry: false,
  });
