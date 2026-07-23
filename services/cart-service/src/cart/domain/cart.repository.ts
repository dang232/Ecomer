import { Cart } from './cart';

export interface CartRepository {
  findByUserId(userId: string): Promise<Cart | null>;
  save(cart: Cart, ttlSeconds: number): Promise<void>;
  delete(userId: string): Promise<void>;
  mergeGuestCart(
    userId: string,
    guestCart: Cart,
    idempotencyKey: string,
  ): Promise<Cart>;
}
