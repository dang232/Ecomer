import { Cart } from '../domain/cart';
import { CartExpirationPolicy } from '../domain/cart-expiration-policy';
import { CartRepository } from '../domain/cart.repository';
import type { ProductClientPort } from './product-client.port';
import { toCartResponse } from './cart-response.mapper';
import type { CartResponse } from './cart.response';

export class ViewCartUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productClient: ProductClientPort,
  ) {}

  async execute(userId: string): Promise<CartResponse> {
    const cart =
      (await this.cartRepository.findByUserId(userId)) ?? Cart.create(userId);

    let changed = false;
    for (const item of cart.items) {
      const snapshot = await this.productClient
        .getSnapshot(item.productId, item.variantId)
        .catch(() => undefined);
      if (snapshot) {
        const parcel = snapshot.parcel;
        changed = cart.replaceParcel(item.itemKey, parcel) || changed;
      }
    }

    if (changed) {
      await this.cartRepository.save(cart, CartExpirationPolicy.TTL_SECONDS);
    }

    return toCartResponse(cart);
  }
}
