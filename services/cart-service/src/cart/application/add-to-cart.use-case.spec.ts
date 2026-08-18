import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository } from '../domain/cart.repository';
import { Money } from '../domain/money';
import { AddToCartUseCase } from './add-to-cart.use-case';
import type { ProductClientPort } from './product-client.port';

describe('AddToCartUseCase', () => {
  it('enriches an existing same-SKU line with trusted parcel metadata while merging quantity', async () => {
    const existingCart = Cart.create('user-1');
    existingCart.addItem(
      CartItem.create('product-1', 'Keyboard', '', Money.of(1000), 2),
    );
    const save = jest.fn();
    const repository: CartRepository = {
      findByUserId: jest.fn().mockResolvedValue(existingCart),
      save,
      refreshParcels: jest.fn(),
      delete: jest.fn(),
      mergeGuestCart: jest.fn(),
    };
    const parcel = {
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    };
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'product-1',
        productName: 'Keyboard',
        productImage: '',
        unitPrice: Money.of(1000),
        parcel,
      }),
    };

    const result = await new AddToCartUseCase(
      repository,
      productClient,
    ).execute({
      userId: 'user-1',
      productId: 'product-1',
      quantity: 3,
      variantId: null,
    });

    expect(result.items[0]?.quantity).toBe(5);
    expect(result.items[0]?.parcel).toEqual(parcel);
    expect(save).toHaveBeenCalledWith(existingCart, expect.any(Number));
    expect(existingCart.items[0]?.quantity).toBe(5);
    expect(existingCart.items[0]?.parcel).toEqual(parcel);
  });
});
