import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";

import { AlertDialog } from "../../../shared/ui/alert-dialog";
import { TextAreaField } from "../../../shared/ui/field";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  icon?: ReactNode;
  reasonField?: boolean;
  isPending?: boolean;
  pendingLabel?: string;
}

/** @deprecated Import AlertDialog from shared/ui/alert-dialog in new code. */
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
  isPending = false,
  pendingLabel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const reasonId = useId();

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
    onClose();
  };

  return (
    <AlertDialog
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={variant === "danger" ? "danger" : "primary"}
      icon={icon}
      confirmDisabled={reasonField ? reason.trim().length < 5 : false}
      pending={isPending}
      pendingLabel={pendingLabel}
    >
      {reasonField ? (
        <TextAreaField
          id={`reason-${reasonId}`}
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Enter reason"
          required
          minLength={5}
          rows={3}
        />
      ) : null}
    </AlertDialog>
  );
}
