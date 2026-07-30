import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";

import type { CartGroupView, CartLineView } from "../model/cart-view";

import { CartLine } from "./cart-line";

interface SellerCartGroupProps {
  group: CartGroupView;
  pendingLineKey?: string | null;
  voucherText?: string;
  onQuantityChange: (line: CartLineView, quantity: number) => void;
  onRemoveRequest: (line: CartLineView) => void;
}

export function SellerCartGroup({
  group,
  pendingLineKey,
  voucherText,
  onQuantityChange,
  onRemoveRequest,
}: SellerCartGroupProps) {
  const { t } = useTranslation();
  const sellerName = group.sellerName ?? t("cart.sellerUnavailable");

  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-card px-4 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <Store className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{sellerName}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {formatPrice(group.subtotalVnd)}
        </span>
      </header>
      {voucherText ? (
        <p className="border-b border-border py-2 text-xs font-medium text-success">
          {voucherText}
        </p>
      ) : null}
      <div>
        {group.lines.map((line) => (
          <CartLine
            key={line.key}
            line={line}
            pending={pendingLineKey === line.key}
            onQuantityChange={onQuantityChange}
            onRemoveRequest={onRemoveRequest}
          />
        ))}
      </div>
    </section>
  );
}
