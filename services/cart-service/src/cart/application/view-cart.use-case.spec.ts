import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository } from '../domain/cart.repository';
import { Money } from '../domain/money';
import { ViewCartUseCase } from './view-cart.use-case';
import type { ProductClientPort } from './product-client.port';

const originalAddedAt = new Date('2026-08-18T09:00:00.000Z');
const completeParcel = {
  weightGrams: 1500,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
};

function cartWithItem(parcel: typeof completeParcel | null): Cart {
  return Cart.fromPersistence(
    'user-1',
    [
      CartItem.fromPersistence(
        'product-1',
        'Keyboard',
        'keyboard.png',
        Money.of(1000),
        3,
        originalAddedAt,
        'sku-large',
        'seller-1',
        'Shop',
        parcel,
      ),
    ],
    new Date('2026-08-18T09:05:00.000Z'),
  );
}

function repository(cart: Cart): CartRepository & { save: jest.Mock } {
  return {
    findByUserId: jest.fn().mockResolvedValue(cart),
    save: jest.fn(),
    delete: jest.fn(),
    mergeGuestCart: jest.fn(),
  };
}

describe('ViewCartUseCase', () => {
  it('refreshes a null parcel from the exact product variant snapshot', async () => {
    const cart = cartWithItem(null);
    const cartRepository = repository(cart);
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'product-1',
        productName: 'Keyboard',
        productImage: 'keyboard.png',
        unitPrice: Money.of(1000),
        parcel: completeParcel,
      }),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');

    expect(productClient.getSnapshot).toHaveBeenCalledWith(
      'product-1',
      'sku-large',
    );
    expect(result.items[0]?.parcel).toEqual(completeParcel);
    expect(cartRepository.save).toHaveBeenCalledWith(cart, expect.any(Number));
  });

  it('replaces stale parcel metadata while preserving line identity and cart fields', async () => {
    const oldParcel = { ...completeParcel, weightGrams: 1000 };
    const cart = cartWithItem(oldParcel);
    const cartRepository = repository(cart);
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'product-1',
        productName: 'Keyboard',
        productImage: 'keyboard.png',
        unitPrice: Money.of(1000),
        parcel: completeParcel,
      }),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');
    const item = result.items[0];

    expect(item?.parcel).toEqual(completeParcel);
    expect(item?.productId).toBe('product-1');
    expect(item?.variantId).toBe('sku-large');
    expect(item?.quantity).toBe(3);
    expect(item?.sellerId).toBe('seller-1');
    expect(item?.unitPrice).toEqual({ amount: 1000, currency: 'VND' });
    expect(item?.addedAt).toBe(originalAddedAt.toISOString());
    expect(cartRepository.save).toHaveBeenCalledWith(cart, expect.any(Number));
  });

  it('preserves trusted parcel metadata when the product snapshot is unavailable', async () => {
    const cart = cartWithItem(completeParcel);
    const cartRepository = repository(cart);
    const productClient: ProductClientPort = {
      getSnapshot: jest
        .fn()
        .mockRejectedValue(new Error('product service unavailable')),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');

    expect(result.items[0]?.parcel).toEqual(completeParcel);
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('keeps parcel null when the authoritative snapshot has no valid parcel', async () => {
    const cart = cartWithItem(null);
    const cartRepository = repository(cart);
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'product-1',
        productName: 'Keyboard',
        productImage: 'keyboard.png',
        unitPrice: Money.of(1000),
        parcel: null,
      }),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');

    expect(result.items[0]?.parcel).toBeNull();
    expect(cartRepository.save).not.toHaveBeenCalled();
  });
});
