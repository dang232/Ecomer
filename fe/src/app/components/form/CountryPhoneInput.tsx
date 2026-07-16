import type { CountryCode } from "libphonenumber-js";
import { useId } from "react";

import {
  DEFAULT_COUNTRY,
  dialCodeForCountry,
  digitsOnly,
  formatAsYouType,
  isValidPhone,
  livePhoneStatus,
  parseOptionalPhone,
  type LivePhoneStatus,
} from "../../lib/validation/phone";

import { CountryDropdown } from "./CountryDropdown";
import { FormField } from "./FormField";

export interface CountryPhoneInputProps {
  /** Full E.164 value (e.g. "+84912345678") or empty string. */
  value: string;
  /** Active country; controls which dial code and validation rules apply. */
  country: CountryCode;
  /** Receives the new full E.164 value (or empty string). */
  onChange: (fullE164: string) => void;
  /** Receives the new country whenever the picker changes. */
  onCountryChange: (country: CountryCode) => void;
  /** Visible label text (already translated). */
  label: string;
  /** Translated helper text shown above the input. */
  helperText: string;
  /** Translated error message. Overrides the live error. */
  error?: string | undefined;
  /** Placeholder shown in the empty input. */
  placeholder?: string;
  /** Disable the input and picker. */
  disabled?: boolean;
  /** Auto-complete attribute. */
  autoComplete?: string;
  /** Locale for sorting country names. */
  locale?: string;
  /** id attribute; defaults to a useId(). */
  id?: string;
}

const STATUS_MESSAGES: Record<LivePhoneStatus, string | undefined> = {
  empty: undefined,
  valid: undefined,
  short: "Phone number is too short for this country",
  long: "Phone number is too long for this country",
  invalid: "Phone number is not valid for this country",
};

/**
 * International phone input: a country picker (ISO code + dial code) on the
 * left, a digits-only text input on the right. Validation runs live against
 * the active country's rules (powered by libphonenumber-js), and the
 * component emits a complete E.164 string via `onChange` so the parent
 * form's state is always BE-ready.
 */
export function CountryPhoneInput({
  value,
  country,
  onChange,
  onCountryChange,
  label,
  helperText,
  error: externalError,
  placeholder,
  disabled,
  autoComplete = "tel",
  locale = "en",
  id,
}: CountryPhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? `phone-${autoId}`;

  // Convert the full E.164 value to a national-numbers-only display string.
  // We strip the active dial code from the front; if the user typed a
  // different country code, the picker would have to change first.
  const dialCode = dialCodeForCountry(country);
  const nationalDigits = value.startsWith(dialCode)
    ? digitsOnly(value.slice(dialCode.length))
    : digitsOnly(value);

  // Format the digits for display per the country's conventions
  // (e.g. VN: "912 345 678"; US: "(202) 555-1234").
  const displayed = formatAsYouType(nationalDigits, country);

  // Live error from the validator, overridden by an explicit external error
  // (e.g. server-side 400).
  const status = livePhoneStatus(nationalDigits, country);
  const liveError = STATUS_MESSAGES[status];
  const error = externalError ?? liveError;
  const isValid = isValidPhone(value, country) || (nationalDigits === "" && value === "");

  const handleInputChange = (raw: string) => {
    // Strip everything but digits. The picker owns the country code.
    const newDigits = digitsOnly(raw);
    onChange(newDigits === "" ? "" : `${dialCode}${newDigits}`);
  };

  const handleCountryChange = (newCountry: CountryCode) => {
    onCountryChange(newCountry);
    // Re-emit the current digits under the new country code so the value
    // always reflects the active country.
    if (nationalDigits) {
      onChange(`${dialCodeForCountry(newCountry)}${nationalDigits}`);
    }
  };

  return (
    <div data-valid={isValid ? "true" : "false"} data-country={country}>
      <FormField
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        disabled={disabled}
        label={label}
        helperText={helperText}
        placeholder={placeholder}
        value={displayed}
        onChange={(e) => handleInputChange(e.target.value)}
        error={error}
        addon={
          <CountryDropdown
            value={country}
            onChange={handleCountryChange}
            locale={locale}
            disabled={disabled}
          />
        }
      />
    </div>
  );
}

// Re-export DEFAULT_COUNTRY so callers that don't have a preference can
// drop it in directly without importing from phone.ts.
export { DEFAULT_COUNTRY, parseOptionalPhone };
