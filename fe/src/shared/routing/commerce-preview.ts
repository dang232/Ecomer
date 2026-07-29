export type CommercePreview = "current" | "modernized";

export function readCommercePreview(
  source: string | URLSearchParams,
  isDevelopment: boolean,
): CommercePreview {
  if (!isDevelopment) return "current";
  const params = typeof source === "string" ? new URLSearchParams(source) : source;
  return params.get("__commercePreview") === "modernized" ? "modernized" : "current";
}
