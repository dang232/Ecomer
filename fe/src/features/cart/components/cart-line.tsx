import { Minus, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { formatPrice } from "@/shared/lib";
import { IconButton, ImageWithFallback } from "@/shared/ui";

import type { CartLineView } from "../model/cart-view";

interface CartLineProps {
  line: CartLineView;
  pending?: boolean;
  onQuantityChange: (line: CartLineView, quantity: number) => void;
  onRemoveRequest: (line: CartLineView) => void;
}

export function CartLine({
  line,
  pending = false,
  onQuantityChange,
  onRemoveRequest,
}: CartLineProps) {
  const { t } = useTranslation();

  return (
    <article className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 border-t border-border py-4 first:border-t-0 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-4">
      <Link
        to={`/product/${line.productId}`}
        aria-label={t("cart.viewProduct", { name: line.name })}
        className="aspect-square overflow-hidden rounded-[var(--radius-control)] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ImageWithFallback
          src={line.imageUrl ?? ""}
          alt={line.name}
          className="h-full w-full object-cover"
          imagePreset="thumbnail"
          sizes="(min-width: 640px) 96px, 80px"
        />
      </Link>
      <div className="min-w-0">
        <Link
          to={`/product/${line.productId}`}
          className="line-clamp-2 text-sm font-semibold leading-5 text-foreground hover:underline"
        >
          {line.name}
        </Link>
        {line.variantId ? (
          <p className="mt-1 text-xs text-muted-foreground">{line.variantId}</p>
        ) : null}
        <p className="mt-2 text-base font-bold text-primary">{formatPrice(line.priceVnd)}</p>
        <p className="text-xs text-muted-foreground">
          {t("cart.lineTotal", { amount: formatPrice(line.priceVnd * line.quantity) })}
        </p>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between">
        <div className="flex h-10 items-center rounded-[var(--radius-control)] border border-border bg-background">
          <IconButton
            label={t("cart.decreaseQuantity", { name: line.name })}
            disabled={pending || line.quantity <= 1}
            onClick={() => onQuantityChange(line, line.quantity - 1)}
            className="min-h-9 min-w-9 p-2"
          >
            <Minus />
          </IconButton>
          <output
            aria-label={t("cart.quantity", { name: line.name })}
            className="w-9 text-center text-sm font-semibold"
          >
            {line.quantity}
          </output>
          <IconButton
            label={t("cart.increaseQuantity", { name: line.name })}
            disabled={pending}
            onClick={() => onQuantityChange(line, line.quantity + 1)}
            className="min-h-9 min-w-9 p-2"
          >
            <Plus />
          </IconButton>
        </div>
        <IconButton
          label={t("cart.removeItem", { name: line.name }) + " from cart"}
          variant="ghost"
          disabled={pending}
          onClick={() => onRemoveRequest(line)}
          className="text-muted-foreground hover:text-error"
        >
          <Trash2 />
        </IconButton>
      </div>
    </article>
  );
}
