import { DisputeQueue } from "@/features/admin-disputes";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminDisputeQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <DisputeQueue
      q={state.q}
      selected={state.selected}
      onSearch={(q) => update({ q })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
