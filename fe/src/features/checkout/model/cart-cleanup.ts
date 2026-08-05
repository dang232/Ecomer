export interface PurchasedCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CartQuantityItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export type CartCleanupOperation =
  | { kind: "update"; productId: string; variantId?: string; quantity: number }
  | { kind: "remove"; productId: string; variantId?: string };

export function cartLineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

export function calculateCartCleanupOperations(
  currentItems: readonly CartQuantityItem[],
  purchasedItems: readonly PurchasedCartItem[],
): CartCleanupOperation[] {
  const purchasedQuantities = new Map<string, number>();
  for (const item of purchasedItems) {
    const key = cartLineKey(item.productId, item.variantId);
    purchasedQuantities.set(key, (purchasedQuantities.get(key) ?? 0) + item.quantity);
  }

  return currentItems.flatMap<CartCleanupOperation>((item) => {
    const purchasedQuantity = purchasedQuantities.get(cartLineKey(item.productId, item.variantId));
    if (purchasedQuantity === undefined) return [];

    const remainingQuantity = item.quantity - purchasedQuantity;
    const operation: CartCleanupOperation =
      remainingQuantity > 0
        ? {
            kind: "update",
            productId: item.productId,
            variantId: item.variantId,
            quantity: remainingQuantity,
          }
        : {
            kind: "remove",
            productId: item.productId,
            variantId: item.variantId,
          };
    return [operation];
  });
}

export async function cleanupThenRedirect(
  redirectUrl: string,
  purchasedItems: readonly PurchasedCartItem[],
  cleanup: (items: readonly PurchasedCartItem[]) => Promise<void>,
  assign: (url: string) => void,
): Promise<void> {
  await cleanup(purchasedItems);
  assign(redirectUrl);
}
