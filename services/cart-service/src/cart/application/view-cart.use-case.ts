import { Cart } from '../domain/cart';
import type { CartRepository, ParcelPatch } from '../domain/cart.repository';
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
    const itemKeys = cart.items.map((item) => item.itemKey);

    const refreshes = await Promise.allSettled(
      cart.items.map((item) =>
        this.productClient.getSnapshot(item.productId, item.variantId),
      ),
    );

    const patches: ParcelPatch[] = [];
    for (let index = 0; index < refreshes.length; index += 1) {
      const refresh = refreshes[index];
      if (refresh?.status === 'fulfilled' && !refresh.value.degraded) {
        const itemKey = itemKeys[index];
        if (itemKey !== undefined) {
          patches.push({ itemKey, parcel: refresh.value.parcel });
        }
      }
    }

    const refreshedCart =
      patches.length > 0
        ? await this.cartRepository.refreshParcels(userId, patches)
        : cart;

    return toCartResponse(refreshedCart);
  }
}
