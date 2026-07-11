/**
 * Country list for the phone-number picker. Built on top of
 * `libphonenumber-js`'s metadata (which is the same data Google uses for
 * Android's dialer), so the country list and per-country digit-count rules
 * stay in lockstep.
 *
 * The full list is ~245 countries. We sort the picker by display name
 * (already-translated) for the active locale, with Vietnam pinned to the
 * top because it's the project's primary market.
 */
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export interface CountryOption {
  /** ISO 3166-1 alpha-2 code, e.g. "VN", "US". Matches libphonenumber-js. */
  code: CountryCode;
  /** Human-readable country name in the current locale. */
  name: string;
  /** International dial code, e.g. "+84", "+1". Always starts with "+". */
  dialCode: string;
  /** Unicode flag emoji, e.g. "🇻🇳". Derived from the ISO code. */
  flag: string;
  /** Convenience flag for the picker UI. */
  isPrimary?: boolean;
}

/**
 * Convert a 2-letter ISO country code into a flag emoji. Uses the regional
 * indicator pair trick: 🇦 (U+1F1E6) + the letter A's offset. No external
 * library needed; this is supported on every modern platform.
 */
const isoToFlag = (code: string): string => {
  const A = 0x1f1e6;
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "🏳️";
  return String.fromCodePoint(
    A + (upper.charCodeAt(0) - "A".charCodeAt(0)),
    A + (upper.charCodeAt(1) - "A".charCodeAt(0)),
  );
};

/** Get every supported country with metadata. */
export const listAllCountries = (locale = "en"): CountryOption[] => {
  const codes = getCountries();
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
  const out: CountryOption[] = [];
  for (const code of codes) {
    const dialCode = `+${getCountryCallingCode(code)}`;
    const name = displayNames?.of(code) ?? code;
    out.push({ code, name, dialCode, flag: isoToFlag(code) });
  }
  return out;
};

/**
 * Vietnam comes first (the project's primary market), then the rest sorted
 * alphabetically by display name in the active locale. This avoids surprising
 * the user with a random country at the top of a 245-item list.
 */
export const sortedCountriesForPicker = (
  locale = "en",
): CountryOption[] => {
  const all = listAllCountries(locale);
  const primary = all.filter((c) => c.code === "VN");
  const rest = all
    .filter((c) => c.code !== "VN")
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [
    ...primary.map((c) => ({ ...c, isPrimary: true })),
    ...rest,
  ];
};

/**
 * Filter the picker list by a free-text query. Matches name, ISO code, and
 * dial code (case-insensitive). Used by the search box at the top of the
 * dropdown.
 */
export const filterCountries = (
  countries: CountryOption[],
  query: string,
): CountryOption[] => {
  const q = query.trim().toLowerCase();
  if (!q) return countries;
  return countries.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.dialCode.includes(q),
  );
};
