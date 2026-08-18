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

    const refreshes = await Promise.allSettled(
      cart.items.map((item) =>
        this.productClient.getSnapshot(item.productId, item.variantId),
      ),
    );

    let changed = false;
    for (let index = 0; index < refreshes.length; index += 1) {
      const refresh = refreshes[index];
      if (refresh?.status === 'fulfilled' && !refresh.value.degraded) {
        changed =
          cart.replaceParcel(cart.items[index]?.itemKey ?? '', refresh.value.parcel) ||
          changed;
      }
    }

    if (changed) {
      await this.cartRepository.save(cart, CartExpirationPolicy.TTL_SECONDS);
    }

    return toCartResponse(cart);
  }
}
