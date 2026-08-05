import { useAuth } from "@/app/hooks/auth-context";
import { PayoutQueue } from "@/features/admin-payouts";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminPayoutQueueRoute() {
  const { subject } = useAuth();
  const { state, update } = useAdminQueueRouteState();

  return (
    <PayoutQueue
      q={state.q}
      status={state.status}
      selected={state.selected}
      currentAdminId={subject}
      onSearch={(q) => update({ q })}
      onStatusChange={(status) => update({ status })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
