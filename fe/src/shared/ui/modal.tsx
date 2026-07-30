import type { MouseEvent, ReactNode, RefObject } from "react";

import { Dialog } from "./dialog";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  dismissDisabled?: boolean;
  triggerRef?: RefObject<Element | null>;
  title?: ReactNode;
  subtitle?: ReactNode;
  hideCloseButton?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  scrollable?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  onBackdropClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

export function Modal({ subtitle, ...props }: ModalProps) {
  return <Dialog {...props} description={subtitle} closeLabel="Close" />;
}
