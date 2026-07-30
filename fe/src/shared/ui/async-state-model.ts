export type AsyncStatus = "loading" | "error" | "empty" | "partial" | "ready";

export function resolveAsyncStatus({
  isLoading,
  hasError,
  isEmpty,
  hasData,
  isPartial = false,
}: {
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  hasData: boolean;
  isPartial?: boolean;
}): AsyncStatus {
  if (hasData) return "ready";
  if (isPartial) return "partial";
  if (isLoading) return "loading";
  if (hasError) return "error";
  if (isEmpty) return "empty";
  return "ready";
}
