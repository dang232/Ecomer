import { queryOptions } from "@tanstack/react-query";

import { adminListUsers } from "@/shared/api/endpoints/admin";

export interface AdminUsersParams {
  q?: string;
  page?: number;
}

export function adminUsersQueryOptions({ q, page }: AdminUsersParams = {}) {
  return queryOptions({
    queryKey: ["admin", "users", { q, page }],
    queryFn: () => adminListUsers({ q, page: (page ?? 1) - 1 }),
    retry: false,
  });
}
