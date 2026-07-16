import type { InputHTMLAttributes, ReactNode } from "react";

import { Field } from "../../../shared/ui/field";

export interface FormFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "prefix"
> {
  /** Field id — used as the input's id, the label's htmlFor, and the error's id prefix. */
  id: string;
  /** Visible label text (already translated). */
  label: string;
  /** Inline error message. When present, input is styled in error state and the message is announced. */
  error?: string | undefined;
  /** Optional hint shown beneath the input when there is no error (e.g. password rules). */
  hint?: ReactNode;
  /** Optional non-editable visual prefix rendered inside the input (e.g. "+84"). */
  addon?: ReactNode;
  /** Optional always-visible helper text shown beneath the label, above the input. */
  helperText?: ReactNode;
}

/**
 * A single labelled form field with consistent error/hint rendering. Replaces
 * the 5 near-identical 25-line blocks that the register form used to repeat
 * per field. Always pairs a `label` with the input via `htmlFor`/`id`, and
 * ties the error paragraph to the input via `aria-describedby` so screen
 * readers announce the error.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  addon,
  helperText,
  className,
  ...inputProps
}: FormFieldProps) {
  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={hint}
      helperText={helperText}
      addon={addon}
      containerClassName="mb-4"
      className={className}
      {...inputProps}
    />
  );
}
