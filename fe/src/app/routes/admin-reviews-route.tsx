import { ReviewModerationQueue } from "@/features/admin-reviews";

import { useAdminQueueRouteState } from "./admin-queue-route-state";

export function AdminReviewModerationQueueRoute() {
  const { state, update } = useAdminQueueRouteState();

  return (
    <ReviewModerationQueue
      q={state.q}
      selected={state.selected}
      onSearch={(q) => update({ q })}
      onSelect={(selected) => update({ selected })}
    />
  );
}
