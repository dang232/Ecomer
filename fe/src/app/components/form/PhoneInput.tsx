import { useId } from "react";

import { FormField } from "./FormField";
import { isValidPhone } from "../../lib/validation/phone";

export interface PhoneInputProps {
  /** Full E.164 value (e.g. "+84912345678") or empty string. The parent owns
   *  the full string; the component only renders and edits the digits part. */
  value: string;
  /** Receives the new full E.164 value (or empty string). */
  onChange: (fullE164: string) => void;
  /** Visible label text (already translated). */
  label: string;
  /** Translated helper text shown above the input. */
  helperText: string;
  /** Translated error message. The component derives its own error from the
   *  digit count, but you can pass a server-side error to override. */
  error?: string | undefined;
  /** Placeholder shown in the empty input (digits only). */
  placeholder?: string;
  /** Disable the input. */
  disabled?: boolean;
  /** Auto-complete attribute. */
  autoComplete?: string;
  /** name attribute for the underlying input (forms). */
  name?: string;
  /** Marks the field as required for assistive tech. */
  required?: boolean;
  /** Optional id; defaults to a useId() so multiple instances don't clash. */
  id?: string;
}

/**
 * Vietnam mobile phone input. The "+84" country prefix is rendered as a
 * non-editable badge inside the input — the user can only type digits
 * (9 or 10 of them). The component owns the digits-only sanitiser; the
 * parent component receives a complete E.164 string via {@link onChange}
 * so the BE contract is unchanged.
 *
 * Validation runs live: as soon as the user has typed 9 or 10 digits, the
 * field is considered valid and the inline error clears. Below 9 digits,
 * the error reads "Phone number is too short" (live). The form-level
 * submit handler does the same check, so even blur+enter without focus
 * change still surfaces the error.
 */
export function PhoneInput({
  value,
  onChange,
  label,
  helperText,
  error: externalError,
  placeholder = "9xxxxxxxxx",
  disabled,
  autoComplete = "tel",
  name,
  required,
  id,
}: PhoneInputProps) {
  const autoId = useId();
  const inputId = id ?? `phone-${autoId}`;

  // Split the full E.164 into the displayed digits. We assume any value
  // the parent gives us either starts with "+84" or is empty.
  const displayed = value.startsWith("+84") ? value.slice(3) : value.replace(/^\+/, "");

  const digitCount = displayed.length;
  // Live error: too short or too long while the user types. We only show
  // the "too short" error after the user has started typing — an empty
  // field is "no phone" and is allowed by the BE.
  const liveError =
    digitCount > 0 && (digitCount < 9 || digitCount > 10)
      ? digitCount < 9
        ? "Phone number is too short (need 9 or 10 digits)"
        : "Phone number is too long (max 10 digits)"
      : digitCount > 0 && !isValidPhone(`+84${displayed}`)
        ? "Phone number is invalid"
        : undefined;
  const error = externalError ?? liveError;
  const isValid = isValidPhone(`+84${displayed}`);

  const handleChange = (raw: string) => {
    // Strip everything that isn't a digit. The user can never type a "+"
    // or a space — the +84 prefix is the badge to the left of the input.
    const digitsOnly = raw.replace(/\D/g, "").slice(0, 10);
    onChange(digitsOnly === "" ? "" : `+84${digitsOnly}`);
  };

  return (
    <div data-valid={isValid ? "true" : "false"} data-digit-count={digitCount}>
      <FormField
        id={inputId}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        name={name}
        required={required}
        disabled={disabled}
        label={label}
        helperText={helperText}
        addon="+84"
        placeholder={placeholder}
        value={displayed}
        onChange={(e) => handleChange(e.target.value)}
        error={error}
      />
    </div>
  );
}
