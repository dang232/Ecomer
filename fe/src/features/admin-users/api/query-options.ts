import { queryOptions } from "@tanstack/react-query";

import { adminListUsers, adminSearchUsersCursor } from "@/shared/api/endpoints/admin";

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

export interface AdminUsersCursorParams {
  q?: string;
  cursor?: string;
  limit?: number;
}

export function adminUsersCursorQueryOptions({ q, cursor, limit }: AdminUsersCursorParams = {}) {
  return queryOptions({
    queryKey: ["admin", "users", "cursor", { q, cursor: cursor ?? null, limit: limit ?? 50 }],
    queryFn: () => adminSearchUsersCursor({ q, cursor, limit: limit ?? 50 }),
    retry: false,
  });
}
