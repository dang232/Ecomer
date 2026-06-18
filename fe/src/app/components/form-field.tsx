/**
 * Standalone labelled form field with consistent error/hint rendering.
 *
 * This component provides `min` / `max` / `inputMode` / `aria-invalid` /
 * `aria-describedby` pass-throughs to the underlying `<input>`, fulfilling
 * the audit P0-11 / P1-6 surface requirements.
 *
 * Note: `form-dialog.tsx` renders fields inline rather than composing this
 * component; this file exists so future dialog consumers can use it directly.
 */
import type { InputHTMLAttributes } from "react";

const BASE_CLASS =
  "w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-card text-foreground outline-none focus:border-[var(--primary)] transition-colors";

const ERROR_CLASS =
  "w-full px-3 py-2.5 border border-red-400 rounded-xl text-sm bg-card text-foreground outline-none focus:border-red-500 transition-colors";

export interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Field id — used as the input's id and the label's htmlFor. */
  id: string;
  /** Visible label text. */
  label: string;
  /** Inline error message. Sets aria-invalid on the input and renders a role="alert" paragraph. */
  error?: string;
  /** Helper text shown beneath the input when there is no error. */
  helper?: string;
}

export function FormField({
  id,
  label,
  error,
  helper,
  className,
  inputMode,
  min,
  max,
  ...rest
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground mb-1.5">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        inputMode={inputMode}
        min={min}
        max={max}
        className={error ? ERROR_CLASS : BASE_CLASS}
        {...rest}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-500">
          {error}
        </p>
      ) : helper ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
