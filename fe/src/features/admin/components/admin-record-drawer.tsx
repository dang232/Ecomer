import type { ReactNode } from "react";

import { Drawer } from "@/shared/ui/drawer";

export interface AdminRecordDrawerProps {
  selectedId: string | null | undefined;
  onClose: () => void;
  children: ReactNode;
  title: string;
  description?: string;
  footer?: ReactNode;
}

/**
 * URL-owned record detail drawer.
 * Closes on Esc or backdrop click; does NOT manipulate the route.
 * The parent is responsible for stripping `?selected=` from the URL on close.
 */
export function AdminRecordDrawer({
  selectedId,
  onClose,
  children,
  title,
  description,
  footer,
}: AdminRecordDrawerProps) {
  return (
    <Drawer
      open={selectedId != null}
      title={title}
      description={description}
      footer={footer}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {children}
    </Drawer>
  );
}
