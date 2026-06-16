/**
 * FE mirror of the BE `@Pattern` for password shape and the `@Size(min = 8)`.
 * Mirrored in `RegisterRequest` (BE) — keep both in sync.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
/** Requires at least one lowercase, one uppercase, and one digit. */
export const PASSWORD_SHAPE_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const isValidPassword = (raw: string): boolean =>
  raw.length >= MIN_PASSWORD_LENGTH &&
  raw.length <= MAX_PASSWORD_LENGTH &&
  PASSWORD_SHAPE_RE.test(raw);
