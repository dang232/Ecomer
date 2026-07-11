import type { ReactNode } from "react";
import { useState } from "react";

import { Modal } from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the reason string when reasonField is enabled; undefined otherwise. */
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  icon?: ReactNode;
  /** When true, renders a required textarea. onConfirm receives the trimmed value. */
  reasonField?: boolean;
}

// ponytail: thin wrapper over Modal — owns only confirm-specific logic (variant, icon, reasonField)
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  icon,
  reasonField = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  const iconWrapperClass =
    variant === "danger"
      ? "w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 [&>svg]:w-6 [&>svg]:h-6"
      : "w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 [&>svg]:w-6 [&>svg]:h-6";

  const confirmBtnClass =
    variant === "danger"
      ? "px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium bg-error text-white hover:opacity-90 transition-opacity"
      : "px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity";

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" hideCloseButton footer={
      <div className="flex gap-3 justify-center w-full">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium border border-border bg-transparent text-foreground hover:bg-background transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={reasonField ? reason.trim().length < 5 : null}
          onClick={() => {
            onConfirm(reason.trim() || undefined);
            setReason("");
            onClose();
          }}
          className={`${confirmBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {confirmLabel}
        </button>
      </div>
    }>
      {icon ? (
        <div className={iconWrapperClass} aria-hidden="true">
          {icon}
        </div>
      ) : null}

      <p className="text-sm text-text-secondary mb-4 text-center">{description}</p>

      {reasonField ? (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason"
          required
          minLength={5}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          aria-label="Reason"
        />
      ) : null}
    </Modal>
  );
}
