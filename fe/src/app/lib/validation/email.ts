/**
 * FE mirror of the BE `email` constraint. BE uses Jakarta `@Email` which is
 * more permissive than this regex, so the FE does the strict shape check
 * first to give a clear error message; the BE accepts whatever passes its
 * validator.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (raw: string): boolean => EMAIL_RE.test(raw.trim());
