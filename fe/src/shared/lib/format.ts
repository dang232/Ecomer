/** Shared formatting helpers (currency / date) used across pages. */

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function formatPrice(price: number): string {
  return VND_FORMATTER.format(price);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return DATE_FORMATTER.format(d);
}

const RELATIVE_TIME_FORMATTERS: Record<string, Intl.RelativeTimeFormat> = {};

function relativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = RELATIVE_TIME_FORMATTERS[locale];
  if (cached) return cached;
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  RELATIVE_TIME_FORMATTERS[locale] = fmt;
  return fmt;
}

/**
 * Render a timestamp as a relative phrase ("2 hours ago", "vừa xong").
 * Returns the empty string for nullish or unparseable input so the caller
 * can render "—" or hide the slot without conditional gymnastics.
 *
 * Locale defaults to vi-VN to match formatDate; pass `en-US` for English
 * surfaces (admin console pages render the user's i18n locale).
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  locale = "vi-VN",
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const fmt = relativeTimeFormatter(locale);
  if (abs < 60) return fmt.format(diffSec, "second");
  if (abs < 60 * 60) return fmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 60 * 60 * 24) return fmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 60 * 60 * 24 * 30) return fmt.format(Math.round(diffSec / 86400), "day");
  if (abs < 60 * 60 * 24 * 365) return fmt.format(Math.round(diffSec / (86400 * 30)), "month");
  return fmt.format(Math.round(diffSec / (86400 * 365)), "year");
}
