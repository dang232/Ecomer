import { AdminUserQueue } from "@/features/admin-users";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminUserQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <AdminUserQueue
      q={state.q}
      selected={state.selected ?? undefined}
      onSearch={(q) => update({ q, page: 1 })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
