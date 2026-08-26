import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository } from '../domain/cart.repository';
import { Money } from '../domain/money';
import { ViewCartUseCase } from './view-cart.use-case';
import type { ProductClientPort } from './product-client.port';
import type { ProductSnapshot } from './product-snapshot';

const originalAddedAt = new Date('2026-08-18T09:00:00.000Z');
const completeParcel = {
  weightGrams: 1500,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
  declaredValueMinor: 100000,
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

function repository(cart: Cart): CartRepository & {
  refreshParcels: jest.Mock;
  save: jest.Mock;
} {
  const refreshParcels = jest.fn().mockImplementation(
    (
      _userId: string,
      patches: readonly {
        itemKey: string;
        parcel: typeof completeParcel | null;
      }[],
    ) => {
      for (const patch of patches) {
        cart.replaceParcel(patch.itemKey, patch.parcel);
      }
      return Promise.resolve(cart);
    },
  );
  return {
    findByUserId: jest.fn().mockResolvedValue(cart),
    save: jest.fn(),
    refreshParcels,
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
    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: completeParcel },
    ]);
    expect(cartRepository.save).not.toHaveBeenCalled();
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
    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: completeParcel },
    ]);
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('refreshes when only declared value changes', async () => {
    const oldParcel = { ...completeParcel, declaredValueMinor: 90000 };
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

    await new ViewCartUseCase(cartRepository, productClient).execute('user-1');

    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: completeParcel },
    ]);
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
    expect(cartRepository.refreshParcels).not.toHaveBeenCalled();
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('preserves trusted parcel metadata when the product snapshot is degraded', async () => {
    const cart = cartWithItem(completeParcel);
    const cartRepository = repository(cart);
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn().mockResolvedValue({
        productId: 'product-1',
        productName: 'product-1',
        productImage: '',
        unitPrice: Money.zero('VND'),
        parcel: null,
        degraded: true,
      }),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');

    expect(result.items[0]?.parcel).toEqual(completeParcel);
    expect(cartRepository.refreshParcels).not.toHaveBeenCalled();
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('refreshes snapshots concurrently and saves once while preserving failed items', async () => {
    const staleParcel = { ...completeParcel, weightGrams: 1000 };
    const cart = cartWithItem(staleParcel);
    cart.addItem(
      CartItem.create(
        'product-2',
        'Mouse',
        'mouse.png',
        Money.of(500),
        1,
        null,
        'seller-2',
        'Shop 2',
        completeParcel,
      ),
    );
    const cartRepository = repository(cart);
    let resolveFirst: ((snapshot: ProductSnapshot) => void) | undefined;
    let rejectSecond: ((reason: Error) => void) | undefined;
    let resolveSecondStarted: (() => void) | undefined;
    const secondStarted = new Promise<void>((resolve) => {
      resolveSecondStarted = resolve;
    });
    const firstSnapshot = new Promise<ProductSnapshot>((resolve) => {
      resolveFirst = resolve;
    });
    const secondSnapshot = new Promise<ProductSnapshot>((_, reject) => {
      rejectSecond = reject;
    });
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn((productId: string) => {
        if (productId === 'product-1') return firstSnapshot;
        resolveSecondStarted?.();
        return secondSnapshot;
      }),
    };

    const execution = new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');
    await secondStarted;
    expect(productClient.getSnapshot).toHaveBeenCalledTimes(2);

    resolveFirst?.({
      productId: 'product-1',
      productName: 'Keyboard',
      productImage: 'keyboard.png',
      unitPrice: Money.of(1000),
      parcel: completeParcel,
    });
    rejectSecond?.(new Error('product service unavailable'));

    const result = await execution;

    expect(
      result.items.find((item) => item.productId === 'product-1')?.parcel,
    ).toEqual(completeParcel);
    expect(
      result.items.find((item) => item.productId === 'product-2')?.parcel,
    ).toEqual(completeParcel);
    expect(cartRepository.refreshParcels).toHaveBeenCalledTimes(1);
    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: completeParcel },
    ]);
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('clears stale parcel metadata when the authoritative snapshot has no valid parcel', async () => {
    const cart = cartWithItem(completeParcel);
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
    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: null },
    ]);
    expect(cartRepository.save).not.toHaveBeenCalled();
  });

  it('returns the atomically refreshed cart so concurrent quantity and added lines survive', async () => {
    const cart = cartWithItem(null);
    cart.addItem(
      CartItem.create(
        'product-2',
        'Mouse',
        'mouse.png',
        Money.of(500),
        1,
        null,
        'seller-2',
        'Shop 2',
        completeParcel,
      ),
    );
    const concurrentCart = Cart.create('user-1');
    concurrentCart.addItem(
      CartItem.fromPersistence(
        'product-1',
        'Keyboard',
        'keyboard.png',
        Money.of(1000),
        7,
        originalAddedAt,
        'sku-large',
        'seller-1',
        'Shop',
        completeParcel,
      ),
    );
    concurrentCart.addItem(
      CartItem.create(
        'product-3',
        'Desk Mat',
        'desk-mat.png',
        Money.of(500),
        1,
        null,
        'seller-3',
        'Shop 3',
        completeParcel,
      ),
    );
    const cartRepository = repository(cart);
    cartRepository.refreshParcels.mockResolvedValue(concurrentCart);
    const productClient: ProductClientPort = {
      getSnapshot: jest.fn((productId: string) =>
        Promise.resolve({
          productId,
          productName: productId === 'product-1' ? 'Keyboard' : 'Mouse',
          productImage: `${productId}.png`,
          unitPrice: Money.of(productId === 'product-1' ? 1000 : 500),
          parcel: completeParcel,
        }),
      ),
    };

    const result = await new ViewCartUseCase(
      cartRepository,
      productClient,
    ).execute('user-1');

    expect(result.items).toHaveLength(2);
    expect(
      result.items.find((item) => item.productId === 'product-1')?.quantity,
    ).toBe(7);
    expect(
      result.items.find((item) => item.productId === 'product-2'),
    ).toBeUndefined();
    expect(
      result.items.find((item) => item.productId === 'product-3')?.quantity,
    ).toBe(1);
    expect(cartRepository.refreshParcels).toHaveBeenCalledWith('user-1', [
      { itemKey: 'product-1:sku-large', parcel: completeParcel },
      { itemKey: 'product-2', parcel: completeParcel },
    ]);
  });
});
