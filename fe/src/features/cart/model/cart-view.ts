import type { CartItem } from "@/shared/contracts/api";

export interface CartLineView {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  imageUrl?: string;
  priceVnd: number;
  quantity: number;
  sellerId: string;
  sellerName?: string;
}

export interface CartGroupView {
  sellerId: string;
  sellerName?: string;
  lines: readonly CartLineView[];
  subtotalVnd: number;
}

export interface CartView {
  groups: readonly CartGroupView[];
  subtotalVnd: number;
  itemCount: number;
}

export const UNKNOWN_SELLER_ID = "unknown-seller";

export function cartLineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

/** Converts transport-shaped cart lines into stable, seller-scoped presentation data. */
export function toCartView(items: readonly CartItem[]): CartView {
  const groups = new Map<string, { sellerName?: string; lines: CartLineView[] }>();

  for (const item of items) {
    const sellerId = item.sellerId ?? UNKNOWN_SELLER_ID;
    const group = groups.get(sellerId) ?? { sellerName: item.sellerName, lines: [] };
    group.lines.push({
      key: cartLineKey(item.productId, item.variantId),
      productId: item.productId,
      variantId: item.variantId,
      name: item.name ?? item.productId,
      imageUrl: item.image ?? undefined,
      priceVnd: item.price,
      quantity: item.quantity,
      sellerId,
      sellerName: item.sellerName,
    });
    groups.set(sellerId, group);
  }

  const viewGroups = Array.from(groups, ([sellerId, group]) => ({
    sellerId,
    sellerName: group.sellerName,
    lines: group.lines,
    subtotalVnd: group.lines.reduce((total, line) => total + line.priceVnd * line.quantity, 0),
  }));

  return {
    groups: viewGroups,
    subtotalVnd: viewGroups.reduce((total, group) => total + group.subtotalVnd, 0),
    itemCount: viewGroups.reduce(
      (total, group) => total + group.lines.reduce((count, line) => count + line.quantity, 0),
      0,
    ),
  };
}
