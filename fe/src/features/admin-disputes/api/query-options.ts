import { queryOptions } from "@tanstack/react-query";

import { adminOpenDisputesCursor } from "@/shared/api/endpoints/admin";

export const adminDisputesCursorQueryOptions = (
  params: {
    q?: string;
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryOptions({
    queryKey: [
      "admin",
      "disputes",
      "cursor",
      params.q ?? "",
      params.cursor ?? null,
      params.limit ?? 50,
    ],
    queryFn: () =>
      adminOpenDisputesCursor({
        q: params.q || undefined,
        cursor: params.cursor,
        limit: params.limit ?? 50,
      }),
    retry: false,
  });
