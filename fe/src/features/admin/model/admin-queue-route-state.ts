export interface AdminQueueRouteState {
  q: string;
  status: string;
  page: number;
  selected: string | null;
}

export interface AdminQueueRouteUpdates {
  q?: string;
  status?: string;
  page?: number;
  selected?: string | null;
}

/** Read the common URL state shared by admin queue route adapters. */
export function readAdminQueueRouteState(source: string | URLSearchParams): AdminQueueRouteState {
  const params = typeof source === "string" ? new URLSearchParams(source) : source;
  const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);

  return {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    selected: params.get("selected") || null,
  };
}

/** Update only the requested queue keys and preserve unrelated URL state. */
export function writeAdminQueueRouteState(
  source: string | URLSearchParams,
  updates: AdminQueueRouteUpdates,
): URLSearchParams {
  const params =
    typeof source === "string" ? new URLSearchParams(source) : new URLSearchParams(source);

  if ("q" in updates) {
    if (updates.q) params.set("q", updates.q);
    else params.delete("q");
  }
  if ("status" in updates) {
    if (updates.status) params.set("status", updates.status);
    else params.delete("status");
  }
  if ("page" in updates) {
    if (updates.page && updates.page > 1) params.set("page", String(updates.page));
    else params.delete("page");
  }
  if ("selected" in updates) {
    if (updates.selected) params.set("selected", updates.selected);
    else params.delete("selected");
  }

  return params;
}
