/**
 * Group a flat list by date sections — Today / Yesterday / This week
 * / per-month for older items. Used by the Seller Orders, Wallet
 * history, and Admin Payouts surfaces (pt32 walkthrough finding —
 * flat lists past ~10 rows scale poorly).
 *
 * Returns the sections in display order (newest first). Items inside
 * each section preserve the input order, so callers can pre-sort how
 * they want.
 */
export interface DateSection<T> {
  /** Stable key for React rendering. */
  key: string;
  /** i18n key — caller resolves with t() since this lib is locale-blind. */
  labelKey: string;
  /** When labelKey is `groupByDate.month`, the locale-formatted month. */
  labelArgs?: Record<string, string | number>;
  items: T[];
}

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const MONTH_FORMATTERS: Record<string, Intl.DateTimeFormat> = {};

function monthFormatter(locale: string): Intl.DateTimeFormat {
  const cached = MONTH_FORMATTERS[locale];
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  MONTH_FORMATTERS[locale] = fmt;
  return fmt;
}

export function groupByDate<T>(
  items: T[],
  dateAccessor: (item: T) => string | number | Date | null | undefined,
  locale = "vi-VN",
): DateSection<T>[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - MS_PER_DAY;
  const weekStart = todayStart - 6 * MS_PER_DAY;

  const today: T[] = [];
  const yesterday: T[] = [];
  const thisWeek: T[] = [];
  const byMonth = new Map<string, T[]>();
  const monthLabels = new Map<string, string>();
  const undated: T[] = [];

  for (const item of items) {
    const raw = dateAccessor(item);
    if (raw === null || raw === undefined || raw === "") {
      undated.push(item);
      continue;
    }
    const d = raw instanceof Date ? raw : new Date(raw);
    const ms = d.getTime();
    if (Number.isNaN(ms)) {
      undated.push(item);
      continue;
    }
    if (ms >= todayStart) {
      today.push(item);
    } else if (ms >= yesterdayStart) {
      yesterday.push(item);
    } else if (ms >= weekStart) {
      thisWeek.push(item);
    } else {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = byMonth.get(key);
      if (existing) {
        existing.push(item);
      } else {
        byMonth.set(key, [item]);
        monthLabels.set(key, monthFormatter(locale).format(d));
      }
    }
  }

  const sections: DateSection<T>[] = [];
  if (today.length > 0)
    sections.push({ key: "today", labelKey: "groupByDate.today", items: today });
  if (yesterday.length > 0)
    sections.push({ key: "yesterday", labelKey: "groupByDate.yesterday", items: yesterday });
  if (thisWeek.length > 0)
    sections.push({ key: "thisWeek", labelKey: "groupByDate.thisWeek", items: thisWeek });

  // Months in reverse-chronological order so the most-recent month
  // comes first under the fixed Today/Yesterday/This-week buckets.
  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return yb !== ya ? (yb ?? 0) - (ya ?? 0) : (mb ?? 0) - (ma ?? 0);
  });
  for (const key of monthKeys) {
    sections.push({
      key,
      labelKey: "groupByDate.month",
      labelArgs: { month: monthLabels.get(key) ?? key },
      items: byMonth.get(key) ?? [],
    });
  }

  if (undated.length > 0)
    sections.push({ key: "undated", labelKey: "groupByDate.undated", items: undated });

  return sections;
}
