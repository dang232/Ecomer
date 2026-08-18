import type { CartItem } from "@/shared/contracts/api/cart";
import type { ParcelDimensions } from "@/shared/contracts/api/product";

export function trustedParcelDimensions(items: readonly CartItem[]): ParcelDimensions | null {
  if (items.length === 0) {
    return null;
  }

  const aggregate: ParcelDimensions = {
    weightGrams: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
  };

  for (const item of items) {
    const parcel = item.parcel;
    if (!parcel) {
      return null;
    }
    aggregate.weightGrams += parcel.weightGrams * item.quantity;
    aggregate.lengthCm = Math.max(aggregate.lengthCm, parcel.lengthCm);
    aggregate.widthCm = Math.max(aggregate.widthCm, parcel.widthCm);
    aggregate.heightCm = Math.max(aggregate.heightCm, parcel.heightCm);
  }

  return aggregate;
}
