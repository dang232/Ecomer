import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';

import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { Money } from '../domain/money';
import { CartPersistenceService } from './cart-persistence.service';
import { CartMikroOrmEntity } from './cart.mikro-orm-entity';

describe('CartPersistenceService', () => {
  it('keeps parcel metadata when repopulating Redis after a Postgres read', async () => {
    const parcel = {
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    };
    const cart = Cart.create('user-1');
    const cartItem = CartItem.create(
      'product-1',
      'Product',
      '',
      Money.of(1000),
      1,
      'sku-1',
      undefined,
      undefined,
      parcel,
    );
    cart.addItem(cartItem);
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [
          {
            productId: 'product-1',
            variantId: 'sku-1',
            productName: 'Product',
            productImage: '',
            unitPrice: { amount: 1000, currency: 'VND' },
            quantity: 1,
            addedAt: cartItem.addedAt.toISOString(),
            parcel,
          },
        ],
        updatedAt: cart.updatedAt.toISOString(),
      },
      updatedAt: cart.updatedAt,
    } as CartMikroOrmEntity;
    const redisGet = jest.fn().mockResolvedValue(null);
    const redisSetex = jest.fn().mockResolvedValue('OK');
    const redis = { get: redisGet, setex: redisSetex } as unknown as Redis;
    const entityManager = {
      fork: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(entity),
      }),
    } as unknown as EntityManager;

    await new CartPersistenceService(entityManager, redis).findByUserId(
      'user-1',
    );

    const payload = JSON.parse(redisSetex.mock.calls[0]?.[2] as string) as {
      items: Array<{ parcel?: typeof parcel }>;
    };
    expect(payload.items[0]?.parcel).toEqual(parcel);
  });
});
