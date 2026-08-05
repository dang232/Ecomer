import { useSearchParams } from "react-router";

import { readAdminQueueRouteState, writeAdminQueueRouteState } from "@/features/admin";

export function useAdminQueueRouteState() {
  const [searchParams, setSearchParams] = useSearchParams();

  return {
    state: readAdminQueueRouteState(searchParams),
    update: (updates: Parameters<typeof writeAdminQueueRouteState>[1]) => {
      setSearchParams((previous) => writeAdminQueueRouteState(previous, updates), {
        replace: true,
      });
    },
  };
}
