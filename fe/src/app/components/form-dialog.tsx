import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, type ButtonVariant } from "../../shared/ui/button";
import { Dialog } from "../../shared/ui/dialog";
import { Field, TextAreaField } from "../../shared/ui/field";

export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
  helper?: string;
  validate?: (value: string) => string | undefined;
  min?: number;
  max?: number;
  inputMode?: "numeric" | "decimal" | "text";
}

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string | string[];
  submitLabel: string;
  /** @deprecated Prefer submitVariant in new code. */
  submitColor?: string;
  submitVariant?: Extract<ButtonVariant, "primary" | "success" | "danger">;
  fields: FormField[];
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  isSubmitting?: boolean;
  cancelLabel?: string;
  pendingLabel?: string;
}

function emptyValues(fields: FormField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, ""]));
}

function legacySubmitVariant(
  color?: string,
): Extract<ButtonVariant, "primary" | "success" | "danger"> {
  if (color?.includes("error")) return "danger";
  if (color?.includes("success")) return "success";
  return "primary";
}

export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  submitColor,
  submitVariant,
  fields,
  onClose,
  onSubmit,
  isSubmitting = false,
  cancelLabel = "Huỷ",
  pendingLabel = "Đang xử lý...",
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(fields));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formId = useId();
  const { t } = useTranslation();

  const handleFieldChange = (key: string, raw: string) => {
    setValues((previous) => ({ ...previous, [key]: raw }));
    if (!fieldErrors[key]) return;
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const required = field.required ?? true;
      const value = (values[field.key] ?? "").trim();
      if (required && !value) {
        errors[field.key] = t("formDialog.fieldRequired", { label: field.label });
      } else {
        const validationMessage = field.validate?.(value);
        if (validationMessage) errors[field.key] = validationMessage;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    onSubmit(
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, (value ?? "").trim()])),
    );
  };

  const descriptionContent = description ? (
    <div className="space-y-1">
      {(Array.isArray(description) ? description : [description]).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={descriptionContent}
      dismissDisabled={isSubmitting}
      closeLabel="Đóng"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            variant={submitVariant ?? legacySubmitVariant(submitColor)}
            onClick={handleSubmit}
            pending={isSubmitting}
            pendingLabel={pendingLabel}
            className="flex-1"
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {fields.map((field, index) => {
          const id = `${formId}-${field.key}`;
          const label = field.required === false ? `${field.label} (tuỳ chọn)` : field.label;
          const sharedProps = {
            id,
            label,
            value: values[field.key] ?? "",
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              handleFieldChange(field.key, event.target.value),
            placeholder: field.placeholder,
            error: fieldErrors[field.key],
            hint: field.helper,
            required: field.required ?? true,
            disabled: isSubmitting,
            "data-autofocus": index === 0 ? true : undefined,
          };

          return field.type === "textarea" ? (
            <TextAreaField key={field.key} {...sharedProps} rows={3} />
          ) : (
            <Field
              key={field.key}
              {...sharedProps}
              type="text"
              inputMode={field.inputMode ?? (field.type === "number" ? "numeric" : undefined)}
              min={field.min}
              max={field.max}
            />
          );
        })}
      </div>
    </Dialog>
  );
}
