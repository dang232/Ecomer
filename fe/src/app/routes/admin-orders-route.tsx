import { AdminOrderQueue } from "@/features/admin-orders";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminOrderQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <AdminOrderQueue
      q={state.q}
      status={state.status}
      page={state.page}
      selected={state.selected}
      onSearch={(q) => update({ q, page: 1 })}
      onStatusChange={(status) => update({ status, page: 1 })}
      onPageChange={(page) => update({ page })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
