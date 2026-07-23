import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { CartExpirationPolicy } from '../domain/cart-expiration-policy';
import { CartRepository } from '../domain/cart.repository';
import type { AddToCartCommand } from './add-to-cart.command';
import type { ProductClientPort } from './product-client.port';
import { toCartResponse } from './cart-response.mapper';
import type { CartResponse } from './cart.response';

export class AddToCartUseCase {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly productClient: ProductClientPort,
  ) {}

  async execute(command: AddToCartCommand): Promise<CartResponse> {
    // Run cart lookup and product snapshot in parallel for better performance
    const [cartResult, snapshot] = await Promise.all([
      this.cartRepository.findByUserId(command.userId),
      this.productClient.getSnapshot(command.productId, command.variantId),
    ]);
    const cart = cartResult ?? Cart.create(command.userId);
    const item = CartItem.create(
      snapshot.productId,
      snapshot.productName,
      snapshot.productImage,
      snapshot.unitPrice,
      command.quantity,
      command.variantId,
      snapshot.sellerId,
      snapshot.sellerName,
    );

    cart.addItem(item);
    await this.cartRepository.save(cart, CartExpirationPolicy.TTL_SECONDS);

    return toCartResponse(cart);
  }
}
