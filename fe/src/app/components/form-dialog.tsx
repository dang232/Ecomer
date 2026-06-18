import { IconX } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState } from "react";

import { useEscapeKey } from "../hooks/use-escape-key";

export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
  helper?: string;
  /** Optional synchronous validator. Return a non-empty string as an error message, or undefined/null for valid. */
  validate?: (value: string) => string | undefined;
  /** HTML input min attribute (passed through to the <input> element). */
  min?: number;
  /** HTML input max attribute (passed through to the <input> element). */
  max?: number;
  /** Overrides the default inputMode for type="number" ("numeric"). Use to set inputMode on text fields. */
  inputMode?: "numeric" | "decimal" | "text";
}

interface FormDialogProps {
  open: boolean;
  title: string;
  /** Single string or array of strings rendered as separate <p> tags. */
  description?: string | string[];
  submitLabel: string;
  submitColor?: string;
  fields: FormField[];
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  isSubmitting?: boolean;
}

function emptyValues(fields: FormField[]): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const f of fields) initial[f.key] = "";
  return initial;
}

/**
 * Generic form dialog. Caller is expected to remount it via `key` (or by only
 * rendering it when `open === true`) when fields or initial values change —
 * the previous useEffect-based reset has been removed because parents already
 * control mount lifecycle through the modal pattern.
 */
export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  submitColor = "var(--primary)",
  fields,
  onClose,
  onSubmit,
  isSubmitting = false,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(fields));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEscapeKey(open && !isSubmitting, onClose);

  if (!open) return null;

  const handleFieldChange = (key: string, raw: string) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
    // Clear the field's error as soon as the user starts correcting it.
    if (fieldErrors[key]) setFieldErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSubmit = () => {
    // Run all validators and collect errors before deciding to submit.
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const required = field.required ?? true;
      const v = (values[field.key] ?? "").trim();
      if (required && !v) {
        errors[field.key] = `Vui lòng nhập ${field.label.toLowerCase()}`;
      } else if (field.validate) {
        const msg = field.validate(v || "");
        if (msg) errors[field.key] = msg;
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const trimmed: Record<string, string> = {};
    Object.entries(values).forEach(([k, v]) => {
      trimmed[k] = (v ?? "").trim();
    });
    onSubmit(trimmed);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-muted hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {description
            ? (Array.isArray(description) ? description : [description]).map((line, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ))
            : null}
          {fields.map((field) => {
            const fieldError = fieldErrors[field.key];
            const errorId = `fd-error-${field.key}`;
            const describedBy = fieldError ? errorId : undefined;
            return (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  {field.label}
                  {field.required === false ? (
                    <span className="text-muted-foreground font-normal"> (tuỳ chọn)</span>
                  ) : null}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    rows={3}
                    placeholder={field.placeholder}
                    aria-describedby={describedBy}
                    aria-invalid={fieldError ? true : undefined}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none ${
                      fieldError
                        ? "border border-red-400 focus:border-red-500"
                        : "border border-border focus:border-[var(--primary)]"
                    }`}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- form-dialog only mounts when the user opens it; first-field focus is expected dialog UX
                    autoFocus={fields.indexOf(field) === 0}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "text" : "text"}
                    inputMode={field.inputMode ?? (field.type === "number" ? "numeric" : undefined)}
                    min={field.min}
                    max={field.max}
                    value={values[field.key] ?? ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    aria-describedby={describedBy}
                    aria-invalid={fieldError ? true : undefined}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${
                      fieldError
                        ? "border border-red-400 focus:border-red-500"
                        : "border border-border focus:border-[var(--primary)]"
                    }`}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- form-dialog only mounts when the user opens it; first-field focus is expected dialog UX
                    autoFocus={fields.indexOf(field) === 0}
                  />
                )}
                {fieldError ? (
                  <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-500">
                    {fieldError}
                  </p>
                ) : field.helper ? (
                  <p className="text-[11px] text-muted-foreground mt-1">{field.helper}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: submitColor }}
          >
            {isSubmitting ? "Đang xử lý..." : submitLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
