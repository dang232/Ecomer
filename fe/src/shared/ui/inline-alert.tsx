import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export type InlineAlertTone = "info" | "success" | "warning" | "danger";

export interface InlineAlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: InlineAlertTone;
  title?: ReactNode;
  children: ReactNode;
}

const toneClasses: Record<InlineAlertTone, string> = {
  info: "border-[var(--commerce-info)] bg-info-light text-[var(--color-info-text)]",
  success: "border-success bg-success-light text-[var(--color-success-text)]",
  warning: "border-accent bg-warning-light text-[var(--color-warning-text)]",
  danger: "border-error bg-error-light text-[var(--color-danger-text)]",
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: InlineAlertProps) {
  const Icon = icons[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 border-l-4 px-4 py-3 text-sm", toneClasses[tone], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}
