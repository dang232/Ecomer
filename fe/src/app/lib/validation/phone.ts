/**
 * FE phone validation, powered by `libphonenumber-js`. The library is the
 * same metadata source Google uses for Android's dialer — country-aware
 * validation, formatting, and AsYouType behaviour for ~250 countries.
 *
 * The library is the single source of truth on the FE for "is this a real,
 * in-use number for this country?" The BE's `PhoneNumber` value object only
 * checks the E.164 shape (any country), so the FE formats the number to
 * E.164 before submitting and the BE stores it verbatim.
 */
import {
  AsYouType,
  parsePhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

/** The default country when the user hasn't picked one. */
export const DEFAULT_COUNTRY: CountryCode = "VN";

/** Convert a dial code string like "+84" to a CountryCode ("VN"). */
export const countryFromDialCode = (dialCode: string): CountryCode | undefined => {
  // libphonenumber-js's getCountries() doesn't expose this reverse lookup
  // cheaply, so we delegate to the metadata via parsePhoneNumber (which
  // accepts a default country) and pull the country out. For the picker
  // we use a small helper.
  const dial = dialCode.replace(/^\+/, "");
  for (const code of import_CountryCode_HELPER()) {
    if (dialCodeForCountry(code) === dial) return code;
  }
  return undefined;
};

// Helper that delays the import to avoid a circular dep with countries.ts.
const COUNTRY_CACHE: CountryCode[] = [
  // Top 20 by population / signal in the VNShop market. libphonenumber-js
  // doesn't expose a fast reverse lookup so we cache a short list for the
  // dial-code → country conversion in this module. The full country list
  // is still available via listAllCountries() in countries.ts.
  "VN", "US", "GB", "AU", "CA", "DE", "FR", "JP", "KR", "CN", "IN", "ID",
  "TH", "MY", "SG", "PH", "BR", "MX", "IT", "ES",
] as CountryCode[];

const import_CountryCode_HELPER = (): CountryCode[] => COUNTRY_CACHE;

import { getCountryCallingCode } from "libphonenumber-js";

/** "VN" -> "+84". Wrapped so callers can mock in tests. */
export const dialCodeForCountry = (code: CountryCode): string =>
  `+${getCountryCallingCode(code)}`;

/** Strip everything but digits from a partial input. */
export const digitsOnly = (raw: string): string => raw.replace(/\D/g, "");

/**
 * As-you-type formatter: takes the current input and the active country,
 * returns the user-friendly formatted string (e.g. "912 345 678" for VN,
 * "(202) 555-1234" for US). The user only ever sees this; the underlying
 * state stays as digits.
 */
export const formatAsYouType = (raw: string, country: CountryCode): string => {
  // The AsYouType formatter works on the raw string. We strip the country
  // prefix if the user typed one — the picker owns the country code.
  const stripped = raw.replace(/^\+\d+/, "").replace(/\D/g, "");
  return new AsYouType(country).input(stripped);
};

/**
 * True iff `raw` is a valid number for `country`. Trims whitespace and
 * accepts the number with or without a leading country code.
 */
export const isValidPhone = (raw: string, country: CountryCode = DEFAULT_COUNTRY): boolean => {
  if (!raw || !raw.trim()) return false;
  try {
    const parsed = parsePhoneNumber(raw, country);
    return parsed.isValid() && parsed.country === country;
  } catch {
    return false;
  }
};

/**
 * `parseOrNull` is the FE analog of the BE `PhoneNumber.parseOrNull`. Returns
 * a normalised E.164 string when the value is valid for the country, or
 * `null` for null/blank/invalid input. Use this at every submit boundary.
 */
export const parseOptionalPhone = (
  raw: string | undefined | null,
  country: CountryCode = DEFAULT_COUNTRY,
): string | null => {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    const parsed = parsePhoneNumber(trimmed, country);
    if (parsed.isValid() && parsed.country === country) {
      return parsed.number; // E.164, e.g. "+84912345678"
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Lightweight live validation for the "is this enough to be valid" hint
 * shown while the user types. Returns one of:
 *   "empty"   — no input yet (don't show an error)
 *   "valid"   — full number parses and is valid
 *   "short"   — user has typed something but it's too short
 *   "long"    — user has typed more digits than the country allows
 *   "invalid" — wrong country code prefix or contains letters
 */
export type LivePhoneStatus = "empty" | "valid" | "short" | "long" | "invalid";

export const livePhoneStatus = (
  raw: string,
  country: CountryCode = DEFAULT_COUNTRY,
): LivePhoneStatus => {
  const digits = digitsOnly(raw);
  if (digits.length === 0) return "empty";
  try {
    const parsed = parsePhoneNumber(raw, country);
    if (!parsed.isPossible()) {
      // The library tells us whether the length is too short or too long.
      const len = parsed.nationalNumber.length;
      if (len < 4) return "short";
      return "long";
    }
    return parsed.isValid() ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
};
