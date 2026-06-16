import { AlertCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

const BASE_INPUT_CLASS =
  "w-full py-3 px-3.5 border-[1.5px] border-border rounded-[var(--radius-lg)] text-sm bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-light)] transition-all";

const ERROR_INPUT_CLASS =
  "w-full py-3 px-3.5 border-[1.5px] border-red-400 rounded-[var(--radius-lg)] text-sm bg-card text-foreground placeholder:text-muted-foreground outline-none focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.2)] transition-all";

export interface FormFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix"> {
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
  const errorId = `${id}-error`;
  // Wire both the error and the helper/hint into aria-describedby so screen
  // readers announce them in order. Use a single space-separated token list
  // rather than a single id to support either or both.
  const describedBy = [
    error ? errorId : null,
    `${id}-helper`,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-foreground mb-1.5"
      >
        {label}
      </label>
      {helperText ? (
        <p id={`${id}-helper`} className="text-xs text-muted-foreground mb-1.5">
          {helperText}
        </p>
      ) : null}
      <div
        className={`flex items-stretch rounded-[var(--radius-lg)] border-[1.5px] transition-all bg-card ${
          error
            ? "border-red-400 focus-within:border-red-500 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
            : "border-border focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--primary-light)]"
        }`}
      >
        {addon ? (
          <span
            aria-hidden="true"
            className="flex items-center px-3 text-sm font-medium text-muted-foreground select-none border-r border-border"
          >
            {addon}
          </span>
        ) : null}
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`flex-1 py-3 px-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none rounded-[var(--radius-lg)]${className ? ` ${className}` : ""}`}
          {...inputProps}
        />
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 mt-1.5 text-xs text-red-600"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
