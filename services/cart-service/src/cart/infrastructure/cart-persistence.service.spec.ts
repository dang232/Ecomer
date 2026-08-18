import { LockMode } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/core';
import type Redis from 'ioredis';

import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { Money } from '../domain/money';
import { CartPersistenceService } from './cart-persistence.service';
import { CartMikroOrmEntity } from './cart.mikro-orm-entity';

describe('CartPersistenceService', () => {
  it('populates Redis only after the read transaction commits and validates the loaded version', async () => {
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
      version: 7,
    } as CartMikroOrmEntity;
    const redisGet = jest.fn().mockResolvedValue(null);
    const events: string[] = [];
    const redisSetex = jest.fn(
      async (_key: string, _ttl: number, _value: string) => {
        events.push('redis-set');
        return 'OK';
      },
    );
    const execute = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactional = jest
      .fn()
      .mockImplementationOnce(
        async (callback: (em: EntityManager) => Promise<unknown>) =>
          callback({
            findOne,
            getConnection: () => ({ execute }),
          } as unknown as EntityManager).then((value) => {
            events.push('read-transaction-committed');
            return value;
          }),
      )
      .mockImplementationOnce(
        async (callback: (em: EntityManager) => Promise<unknown>) =>
          callback({
            findOne: jest.fn().mockResolvedValue(entity),
            getConnection: () => ({ execute }),
          } as unknown as EntityManager).then((value) => {
            events.push('validation-transaction-committed');
            return value;
          }),
      );
    const redis = { get: redisGet, setex: redisSetex } as unknown as Redis;
    const entityManager = {
      transactional,
    } as unknown as EntityManager;

    await new CartPersistenceService(entityManager, redis).findByUserId(
      'user-1',
    );

    const payload = JSON.parse(redisSetex.mock.calls[0]?.[2] as string) as {
      items: Array<{ parcel?: typeof parcel }>;
      version: number;
    };
    expect(payload.items[0]?.parcel).toEqual(parcel);
    expect(payload.version).toBe(7);
    expect(events).toEqual([
      'read-transaction-committed',
      'redis-set',
      'validation-transaction-committed',
    ]);
    expect(execute).toHaveBeenCalledWith(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      ['user-1'],
    );
    expect(findOne).toHaveBeenCalledWith(
      CartMikroOrmEntity,
      { userId: 'user-1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(transactional).toHaveBeenCalledTimes(2);
  });

  it('locks the current row, serializes only parcel patches, ignores unknown keys, and invalidates Redis after commit', async () => {
    const oldParcel = {
      weightGrams: 1000,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    };
    const newParcel = { ...oldParcel, weightGrams: 1500 };
    const cart = Cart.create('user-1');
    const item = CartItem.create(
      'product-1',
      'Product',
      '',
      Money.of(1000),
      2,
      'sku-1',
      undefined,
      undefined,
      oldParcel,
    );
    cart.addItem(item);
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
            quantity: 2,
            addedAt: item.addedAt.toISOString(),
            parcel: oldParcel,
          },
        ],
        updatedAt: cart.updatedAt.toISOString(),
      },
      updatedAt: cart.updatedAt,
    } as CartMikroOrmEntity;
    const flush = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<Cart>) =>
        callback({
          findOne,
          flush,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const redisDel = jest.fn().mockResolvedValue(1);
    const redis = { del: redisDel } as unknown as Redis;
    const entityManager = { transactional } as unknown as EntityManager;

    const result = await new CartPersistenceService(
      entityManager,
      redis,
    ).refreshParcels('user-1', [
      { itemKey: 'product-1:sku-1', parcel: newParcel },
      { itemKey: 'missing', parcel: null },
    ]);

    expect(findOne).toHaveBeenCalledWith(
      CartMikroOrmEntity,
      { userId: 'user-1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(flush).toHaveBeenCalledTimes(1);
    expect(entity.items).toMatchObject({
      items: [expect.objectContaining({ parcel: newParcel, quantity: 2 })],
    });
    expect(result.items[0]?.parcel).toEqual(newParcel);
    expect(redisDel).toHaveBeenCalledWith('cart:user-1');
  });

  it('clears an existing parcel authoritatively and does not write when patches are unchanged or unknown', async () => {
    const parcel = {
      weightGrams: 1500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    };
    const cart = Cart.create('user-1');
    const item = CartItem.create(
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
    cart.addItem(item);
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
            addedAt: item.addedAt.toISOString(),
            parcel,
          },
        ],
        updatedAt: cart.updatedAt.toISOString(),
      },
      updatedAt: cart.updatedAt,
    } as CartMikroOrmEntity;
    const flush = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<Cart>) =>
        callback({
          findOne,
          flush,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const redisDel = jest.fn().mockResolvedValue(1);
    const redis = { del: redisDel } as unknown as Redis;
    const entityManager = { transactional } as unknown as EntityManager;
    const service = new CartPersistenceService(entityManager, redis);

    const cleared = await service.refreshParcels('user-1', [
      { itemKey: 'product-1:sku-1', parcel: null },
    ]);
    expect(cleared.items[0]?.parcel).toBeNull();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledTimes(1);

    flush.mockClear();
    redisDel.mockClear();
    await service.refreshParcels('user-1', [
      { itemKey: 'product-1:sku-1', parcel: null },
      { itemKey: 'missing', parcel },
    ]);
    expect(flush).not.toHaveBeenCalled();
    expect(redisDel).toHaveBeenCalledTimes(1);
  });

  it('clears Redis after a committed cache miss finds no Postgres row', async () => {
    const execute = jest.fn().mockResolvedValue([]);
    const redisDel = jest.fn().mockResolvedValue(1);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<Cart | null>) =>
        callback({
          findOne: jest.fn().mockResolvedValue(null),
          getConnection: () => ({ execute }),
        } as unknown as EntityManager),
    );
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      del: redisDel,
    } as unknown as Redis;

    const cart = await new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      redis,
    ).findByUserId('user-1');

    expect(cart).toBeNull();
    expect(redisDel).toHaveBeenCalledWith('cart:user-1');
    expect(execute).toHaveBeenCalledWith(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      ['user-1'],
    );
  });

  it('deletes Redis after validation detects a stale loaded version', async () => {
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 3,
    } as CartMikroOrmEntity;
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(entity)
      .mockResolvedValueOnce({ ...entity, version: 4 });
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<unknown>) =>
        callback({
          findOne,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const redisSetex = jest.fn().mockResolvedValue('OK');
    const redisDel = jest.fn().mockResolvedValue(1);
    const service = new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      {
        get: jest.fn().mockResolvedValue(null),
        setex: redisSetex,
        del: redisDel,
      } as unknown as Redis,
    );

    const cart = await service.findByUserId('user-1');

    expect(cart?.version).toBe(3);
    expect(redisSetex).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledWith('cart:user-1');
    expect(transactional).toHaveBeenCalledTimes(2);
  });

  it('does not return an old generation after a delete and recreate ABA cycle', async () => {
    const oldGeneration = 'old-generation';
    const newGeneration = 'new-generation';
    const redisGet = jest.fn().mockResolvedValue(
      JSON.stringify({
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
        version: 1,
        generationId: oldGeneration,
      }),
    );
    const redisSetex = jest.fn().mockResolvedValue('OK');
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
        generationId: newGeneration,
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 1,
    } as CartMikroOrmEntity;
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<unknown>) =>
        callback({
          findOne,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const service = new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      { get: redisGet, setex: redisSetex, del: jest.fn() } as unknown as Redis,
    );

    const result = await service.findByUserId('user-1');

    expect(result?.generationId).toBe(newGeneration);
    const refreshed = JSON.parse(redisSetex.mock.calls[0]?.[2] as string) as {
      generationId: string;
    };
    expect(refreshed.generationId).toBe(newGeneration);
  });

  it('returns the current database cart after a failed Redis invalidation', async () => {
    const currentGeneration = 'current-generation';
    const currentEntity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
        generationId: currentGeneration,
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 2,
    } as CartMikroOrmEntity;
    const findOne = jest.fn().mockResolvedValue(currentEntity);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<unknown>) =>
        callback({
          findOne,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const redisGet = jest.fn().mockResolvedValue(
      JSON.stringify({
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T08:00:00.000Z',
        version: 1,
        generationId: 'stale-generation',
      }),
    );
    const redisSetex = jest
      .fn()
      .mockRejectedValue(new Error('Redis unavailable'));
    const redisDel = jest
      .fn()
      .mockRejectedValue(new Error('Redis unavailable'));

    const result = await new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      { get: redisGet, setex: redisSetex, del: redisDel } as unknown as Redis,
    ).findByUserId('user-1');

    expect(result?.version).toBe(2);
    expect(result?.generationId).toBe(currentGeneration);
    expect(transactional).toHaveBeenCalledTimes(1);
  });

  it('falls through to Postgres and refreshes Redis when the cached payload has no version', async () => {
    const redisGet = jest.fn().mockResolvedValue(
      JSON.stringify({
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
      }),
    );
    const redisSetex = jest.fn().mockResolvedValue('OK');
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 3,
    } as CartMikroOrmEntity;
    const findOne = jest.fn().mockResolvedValue(entity);
    const redis = { get: redisGet, setex: redisSetex } as unknown as Redis;
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<unknown>) =>
        callback({
          findOne,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const entityManager = { transactional } as unknown as EntityManager;

    const cart = await new CartPersistenceService(
      entityManager,
      redis,
    ).findByUserId('user-1');

    expect(cart?.version).toBe(3);
    expect(findOne).toHaveBeenCalledWith(
      CartMikroOrmEntity,
      { userId: 'user-1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    const payload = JSON.parse(redisSetex.mock.calls[0]?.[2] as string) as {
      version: number;
    };
    expect(payload.version).toBe(3);
  });

  it('rejects a stale full-cart save after the row version advances', async () => {
    const cart = Cart.fromPersistence(
      'user-1',
      [CartItem.create('product-1', 'Product', '', Money.of(1000), 1)],
      new Date('2026-08-18T09:00:00.000Z'),
      1,
    );
    cart.updateItemQuantity('product-1', 2);
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: cart.updatedAt.toISOString(),
      },
      updatedAt: cart.updatedAt,
      version: 2,
    } as CartMikroOrmEntity;
    const findOne = jest.fn().mockResolvedValue(entity);
    const flush = jest.fn().mockResolvedValue(undefined);
    const execute = jest.fn().mockResolvedValue([]);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<void>) =>
        callback({
          findOne,
          flush,
          getConnection: () => ({ execute }),
        } as unknown as EntityManager),
    );
    const redis = { del: jest.fn() } as unknown as Redis;

    await expect(
      new CartPersistenceService(
        { transactional } as unknown as EntityManager,
        redis,
      ).save(cart, 3600),
    ).rejects.toMatchObject({ code: 'CART_VERSION_CONFLICT' });

    expect(findOne).toHaveBeenCalledWith(
      CartMikroOrmEntity,
      { userId: 'user-1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects a persisted snapshot when clear removed its row instead of resurrecting it', async () => {
    const cart = Cart.fromPersistence(
      'user-1',
      [CartItem.create('product-1', 'Product', '', Money.of(1000), 1)],
      new Date('2026-08-18T09:00:00.000Z'),
      4,
    );
    const findOne = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const persistAndFlush = jest.fn();
    const execute = jest.fn().mockResolvedValue([]);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<void>) =>
        callback({
          findOne,
          create,
          persistAndFlush,
          getConnection: () => ({ execute }),
        } as unknown as EntityManager),
    );
    const redis = { del: jest.fn() } as unknown as Redis;

    await expect(
      new CartPersistenceService(
        { transactional } as unknown as EntityManager,
        redis,
      ).save(cart, 3600),
    ).rejects.toMatchObject({ code: 'CART_VERSION_CONFLICT' });

    expect(create).not.toHaveBeenCalled();
    expect(persistAndFlush).not.toHaveBeenCalled();
  });

  it('preserves processed merge keys when saving an existing cart', async () => {
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
        processedMergeKeys: ['merge-1'],
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 2,
    } as CartMikroOrmEntity;
    const flush = jest.fn().mockResolvedValue(undefined);
    const findOne = jest.fn().mockResolvedValue(entity);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<void>) =>
        callback({
          findOne,
          flush,
          getConnection: () => ({ execute: jest.fn().mockResolvedValue([]) }),
        } as unknown as EntityManager),
    );
    const cart = Cart.fromPersistence(
      'user-1',
      [],
      new Date('2026-08-18T09:01:00.000Z'),
      2,
    );

    await new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      { del: jest.fn().mockResolvedValue(1) } as unknown as Redis,
    ).save(cart, 3600);

    expect(
      (entity.items as { processedMergeKeys: string[] }).processedMergeKeys,
    ).toEqual(['merge-1']);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('replays a merge idempotently without touching the guest cart on the second call', async () => {
    const guestItem = {
      productId: 'product-1',
      variantId: null,
      productName: 'Product',
      productImage: '',
      unitPrice: { amount: 1000, currency: 'VND' },
      quantity: 2,
      addedAt: '2026-08-18T09:00:00.000Z',
    };
    const guestEntity = {
      userId: 'guest:session-1',
      items: {
        userId: 'guest:session-1',
        items: [guestItem],
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 1,
    } as CartMikroOrmEntity;
    const mergedEntity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [guestItem],
        updatedAt: '2026-08-18T09:00:00.000Z',
        processedMergeKeys: ['merge-1'],
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 1,
    } as CartMikroOrmEntity;
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(guestEntity)
      .mockResolvedValueOnce(mergedEntity);
    const create = jest.fn().mockReturnValue(mergedEntity);
    const persist = jest.fn();
    const remove = jest.fn();
    const flush = jest.fn().mockResolvedValue(undefined);
    const execute = jest.fn().mockResolvedValue([]);
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<Cart>) =>
        callback({
          findOne,
          create,
          persist,
          remove,
          flush,
          getConnection: () => ({ execute }),
        } as unknown as EntityManager),
    );
    const redisDel = jest.fn().mockResolvedValue(1);
    const service = new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      { del: redisDel } as unknown as Redis,
    );
    const guestCart = Cart.create('guest:session-1');

    const first = await service.mergeGuestCart('user-1', guestCart, 'merge-1');
    const second = await service.mergeGuestCart('user-1', guestCart, 'merge-1');

    expect(first.itemCount).toBe(2);
    expect(second.itemCount).toBe(2);
    expect(second.version).toBe(1);
    expect(findOne).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(redisDel).toHaveBeenCalledTimes(4);
  });

  it('locks and removes an existing cart before invalidating Redis', async () => {
    const entity = {
      userId: 'user-1',
      items: {
        userId: 'user-1',
        items: [],
        updatedAt: '2026-08-18T09:00:00.000Z',
      },
      updatedAt: new Date('2026-08-18T09:00:00.000Z'),
      version: 1,
    } as CartMikroOrmEntity;
    const execute = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue(entity);
    const removeAndFlush = jest.fn().mockResolvedValue(undefined);
    const events: string[] = [];
    const transactional = jest.fn(
      async (callback: (em: EntityManager) => Promise<void>) =>
        callback({
          findOne,
          removeAndFlush: jest.fn(async (value: CartMikroOrmEntity) => {
            expect(value).toBe(entity);
            events.push('removed');
            return removeAndFlush(value);
          }),
          getConnection: () => ({ execute }),
        } as unknown as EntityManager).then(() => {
          events.push('committed');
        }),
    );
    const redisDel = jest.fn(async () => {
      events.push('redis-invalidated');
      return 1;
    });

    await new CartPersistenceService(
      { transactional } as unknown as EntityManager,
      { del: redisDel } as unknown as Redis,
    ).delete('user-1');

    expect(execute).toHaveBeenCalledWith(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      ['user-1'],
    );
    expect(findOne).toHaveBeenCalledWith(CartMikroOrmEntity, {
      userId: 'user-1',
    });
    expect(removeAndFlush).toHaveBeenCalledWith(entity);
    expect(redisDel).toHaveBeenCalledWith('cart:user-1');
    expect(events).toEqual(['removed', 'committed', 'redis-invalidated']);
  });
});
