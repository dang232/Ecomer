/**
 * Sanitizes a redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with "/" (but not "//").
 * Rejects absolute URLs, protocol-relative URLs, and other schemes.
 */
export function sanitizeRedirect(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  // Only allow paths starting with single slash (not protocol-relative //)
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return "/";
}

function hasExplicitSafeRedirect(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

/**
 * Chooses the post-login destination without allowing an external redirect.
 * An explicit safe `next` always wins; otherwise admins enter the console.
 */
export function resolvePostLoginRedirect(
  rawNext: string | null | undefined,
  roles: readonly string[],
): string {
  if (hasExplicitSafeRedirect(rawNext)) return sanitizeRedirect(rawNext);
  return roles.includes("ADMIN") ? "/admin" : "/";
}
