import { AlertCircle } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/cn";

interface FieldFrameProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  helperText?: ReactNode;
  addon?: ReactNode;
  trailing?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

function FieldFrame({
  id,
  label,
  error,
  hint,
  helperText,
  addon,
  trailing,
  required,
  disabled,
  className,
  children,
}: FieldFrameProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {helperText ? (
        <div id={helperId} className="text-xs text-muted-foreground">
          {helperText}
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-h-[var(--target-web)] items-stretch overflow-visible rounded-[var(--radius-control)] border bg-card transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          error ? "border-error" : "border-border",
          disabled && "cursor-not-allowed bg-muted opacity-60",
        )}
      >
        {addon ? (
          <div className="flex shrink-0 items-center border-r border-border px-3 text-sm text-muted-foreground">
            {addon}
          </div>
        ) : null}
        {children(describedBy)}
        {trailing ? (
          <div className="flex shrink-0 items-center px-2 text-muted-foreground">{trailing}</div>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix"> {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  helperText?: ReactNode;
  addon?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    id,
    label,
    error,
    hint,
    helperText,
    addon,
    trailing,
    required,
    disabled,
    containerClassName,
    className,
    "aria-describedby": externalDescribedBy,
    ...props
  },
  ref,
) {
  return (
    <FieldFrame
      id={id}
      label={label}
      error={error}
      hint={hint}
      helperText={helperText}
      addon={addon}
      trailing={trailing}
      required={required}
      disabled={disabled}
      className={containerClassName}
    >
      {(describedBy) => (
        <input
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [externalDescribedBy, describedBy].filter(Boolean).join(" ") || undefined
          }
          className={cn(
            "min-w-0 flex-1 rounded-[var(--radius-control)] bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground",
            className,
          )}
          {...props}
        />
      )}
    </FieldFrame>
  );
});

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id"
> {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  helperText?: ReactNode;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    {
      id,
      label,
      error,
      hint,
      helperText,
      required,
      disabled,
      containerClassName,
      className,
      "aria-describedby": externalDescribedBy,
      ...props
    },
    ref,
  ) {
    return (
      <FieldFrame
        id={id}
        label={label}
        error={error}
        hint={hint}
        helperText={helperText}
        required={required}
        disabled={disabled}
        className={containerClassName}
      >
        {(describedBy) => (
          <textarea
            ref={ref}
            id={id}
            required={required}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [externalDescribedBy, describedBy].filter(Boolean).join(" ") || undefined
            }
            className={cn(
              "min-h-24 min-w-0 flex-1 resize-y rounded-[var(--radius-control)] bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground",
              className,
            )}
            {...props}
          />
        )}
      </FieldFrame>
    );
  },
);
