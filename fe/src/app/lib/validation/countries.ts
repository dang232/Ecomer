/**
 * Country list for the phone-number picker. Built on top of
 * `libphonenumber-js`'s metadata (which is the same data Google uses for
 * Android's dialer), so the country list and per-country digit-count rules
 * stay in lockstep.
 *
 * The full list is ~250 countries. We sort the picker by display name
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
  /** Convenience flag for the picker UI. */
  isPrimary?: boolean;
}

/** Get every supported country with metadata. */
export const listAllCountries = (locale: string = "en"): CountryOption[] => {
  const codes = getCountries();
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
  const out: CountryOption[] = [];
  for (const code of codes) {
    const dialCode = `+${getCountryCallingCode(code)}`;
    const name = displayNames?.of(code) ?? code;
    out.push({ code, name, dialCode });
  }
  return out;
};

/**
 * Vietnam comes first (the project's primary market), then the rest sorted
 * alphabetically by display name in the active locale. This avoids surprising
 * the user with a random country at the top of a 250-item list.
 */
export const sortedCountriesForPicker = (
  locale: string = "en",
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
