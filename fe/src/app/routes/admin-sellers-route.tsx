import { SellerApprovalQueue } from "@/features/admin-sellers";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminSellerApprovalQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <SellerApprovalQueue
      q={state.q}
      selected={state.selected}
      onSearch={(q) => update({ q })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
