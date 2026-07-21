import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository } from '../domain/cart.repository';
import type { ProductClientPort } from './product-client.port';
import { toCartResponse } from './cart-response.mapper';
import type { CartResponse } from './cart.response';

export class MergeCartUseCase {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly productClient: ProductClientPort,
  ) {}

  async execute(
    userId: string,
    guestSessionId: string,
    items: readonly { productId: string; quantity: number; variantId?: string }[],
    idempotencyKey: string,
  ): Promise<CartResponse> {
    const guestKey = `guest:${guestSessionId}`;
    const snapshots = await Promise.all(
      items.map((item) => this.productClient.getSnapshot(item.productId, item.variantId)),
    );
    const guestCart = Cart.create(guestKey);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const snapshot = snapshots[index];
      guestCart.addItem(
        CartItem.create(
          snapshot.productId,
          snapshot.productName,
          snapshot.productImage,
          snapshot.unitPrice,
          item.quantity,
          item.variantId,
        ),
      );
    }

    return toCartResponse(
      await this.cartRepo.mergeGuestCart(userId, guestCart, idempotencyKey),
    );
  }
}
