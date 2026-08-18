import type { CartItem } from "@/shared/contracts/api/cart";

export function hasTrustedParcelMetadata(items: readonly CartItem[]): boolean {
  return items.length > 0 && items.every((item) => item.parcel !== null);
}
