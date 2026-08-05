import { AdminUserQueue } from "@/features/admin-users";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminUserQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <AdminUserQueue
      q={state.q}
      page={state.page}
      selected={state.selected ?? undefined}
      onSearch={(q) => update({ q, page: 1 })}
      onPageChange={(page) => update({ page })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
