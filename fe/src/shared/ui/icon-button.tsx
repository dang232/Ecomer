import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../lib/cn";

import { Button, type ButtonVariant } from "./button";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  tooltip?: string;
  variant?: ButtonVariant;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tooltip = label, variant = "ghost", className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      aria-label={label}
      title={tooltip}
      className={cn("shrink-0", className)}
      {...props}
    >
      <span aria-hidden="true" className="[&>svg]:h-5 [&>svg]:w-5">
        {children}
      </span>
    </Button>
  );
});
