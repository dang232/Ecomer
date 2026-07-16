export type AsyncStatus = "loading" | "error" | "empty" | "ready";

export function resolveAsyncStatus({
  isLoading,
  hasError,
  isEmpty,
  hasData,
}: {
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  hasData: boolean;
}): AsyncStatus {
  if (hasData) return "ready";
  if (isLoading) return "loading";
  if (hasError) return "error";
  if (isEmpty) return "empty";
  return "ready";
}
