import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { Money } from '../domain/money';
import type { CartRepository } from '../domain/cart.repository';
import type { ProductClientPort } from './product-client.port';
import { MergeCartUseCase } from './merge-cart.use-case';

describe('MergeCartUseCase', () => {
  it('builds a guest snapshot and delegates one atomic, idempotent merge', async () => {
    const merged = Cart.create('user-1');
    merged.addItem(CartItem.create('p1', 'Product', '', Money.of(1000), 5));
    const mergeGuestCart = jest.fn().mockResolvedValue(merged);
    const repository: CartRepository = {
      findByUserId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      mergeGuestCart,
    };
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'p1',
        productName: 'Product',
        productImage: '',
        unitPrice: Money.of(1000),
        parcel: null,
      }),
    };

    const result = await new MergeCartUseCase(repository, productClient).execute(
      'user-1',
      'session-1',
      [{ productId: 'p1', quantity: 2 }],
      'merge-key-1',
    );

    expect(mergeGuestCart).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ userId: 'guest:session-1' }),
      'merge-key-1',
    );
    expect(result.itemCount).toBe(5);
  });
});
