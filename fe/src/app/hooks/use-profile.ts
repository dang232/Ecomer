import { queryOptions, useQuery } from "@tanstack/react-query";

import { myProfile } from "@/shared/api/endpoints/users";
import type { UserProfile } from "@/shared/contracts/api";

export const profileOptions = () =>
  queryOptions<UserProfile>({
    queryKey: ["users", "me"] as const,
    queryFn: myProfile,
  });

/**
 * Current user's profile from /users/me. Pass `enabled` to gate on auth state:
 *   const { data } = useProfile({ enabled: ready && authenticated });
 */
export function useProfile({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...profileOptions(), enabled });
}
