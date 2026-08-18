import { Cart } from './cart';
import type { ParcelDimensions } from './parcel-dimensions';

export interface ParcelPatch {
  readonly itemKey: string;
  readonly parcel: ParcelDimensions | null;
}

export interface CartRepository {
  findByUserId(userId: string): Promise<Cart | null>;
  save(cart: Cart, ttlSeconds: number): Promise<void>;
  refreshParcels(
    userId: string,
    patches: readonly ParcelPatch[],
  ): Promise<Cart>;
  delete(userId: string): Promise<void>;
  mergeGuestCart(
    userId: string,
    guestCart: Cart,
    idempotencyKey: string,
  ): Promise<Cart>;
}
