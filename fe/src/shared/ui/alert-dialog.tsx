import type { ReactNode } from "react";

import { cn } from "../lib/cn";

import { Button } from "./button";
import { Dialog } from "./dialog";

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: "primary" | "danger";
  icon?: ReactNode;
  children?: ReactNode;
  confirmDisabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
}

export function AlertDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  icon,
  children,
  confirmDisabled = false,
  pending = false,
  pendingLabel,
}: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      hideCloseButton
      dismissDisabled={pending}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={confirmDisabled}
            pending={pending}
            pendingLabel={pendingLabel ?? confirmLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full [&>svg]:h-6 [&>svg]:w-6",
            variant === "danger" ? "bg-error-light text-error" : "bg-primary-light text-primary",
          )}
        >
          {icon}
        </div>
      ) : null}
      {children}
    </Dialog>
  );
}
