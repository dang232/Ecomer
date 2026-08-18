import type Redis from 'ioredis';

import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { Money } from '../domain/money';
import { CartRedisRepository } from './cart.redis-repository';

describe('CartRedisRepository', () => {
  it('surfaces a command error returned by EXEC during save', async () => {
    const commandError = new Error('Redis write failed');
    const exec = jest.fn().mockResolvedValue([[commandError, null]]);
    const transaction = {
      watch: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      multi: jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec,
      }),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      duplicate: jest.fn().mockReturnValue(transaction),
    } as unknown as Redis;

    await expect(
      new CartRedisRepository(redis).save(Cart.create('user-1'), 3600),
    ).rejects.toBe(commandError);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(transaction.quit).toHaveBeenCalledTimes(1);
  });

  it('retains processed merge keys when saving a versioned cart', async () => {
    const current = JSON.stringify({
      userId: 'user-1',
      items: [],
      updatedAt: '2026-08-18T09:00:00.000Z',
      version: 2,
      processedMergeKeys: ['merge-1'],
    });
    const setex = jest.fn().mockReturnThis();
    const exec = jest.fn().mockResolvedValue([[null, 'OK']]);
    const transaction = {
      watch: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(current),
      multi: jest.fn().mockReturnValue({ setex, exec }),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      duplicate: jest.fn().mockReturnValue(transaction),
    } as unknown as Redis;
    const cart = Cart.fromPersistence(
      'user-1',
      [],
      new Date('2026-08-18T09:00:00.000Z'),
      2,
    );

    await new CartRedisRepository(redis).save(cart, 3600);

    const payload = JSON.parse(setex.mock.calls[0]?.[2] as string) as {
      version: number;
      processedMergeKeys: string[];
    };
    expect(payload.version).toBe(3);
    expect(payload.processedMergeKeys).toEqual(['merge-1']);
  });

  it('watches both cart keys and retries an aborted merge without duplicating an idempotent request', async () => {
    const idempotencyKey = 'merge-1';
    const guestCart = Cart.create('guest:session-1');
    guestCart.addItem(
      CartItem.create('product-1', 'Product', '', Money.of(1000), 1),
    );
    const reloadedGuest = Cart.create('guest:session-1');
    reloadedGuest.addItem(
      CartItem.create('product-2', 'Reloaded product', '', Money.of(2000), 1),
    );
    const exec = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([
        [null, 'OK'],
        [null, 1],
      ]);
    const setex = jest.fn().mockReturnThis();
    const del = jest.fn().mockReturnThis();
    const transaction = {
      watch: jest.fn().mockResolvedValue('OK'),
      unwatch: jest.fn().mockResolvedValue('OK'),
      get: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          JSON.stringify({
            userId: reloadedGuest.userId,
            items: reloadedGuest.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              productImage: item.productImage,
              unitPrice: {
                amount: item.unitPrice.amount,
                currency: item.unitPrice.currency,
              },
              quantity: item.quantity,
              addedAt: item.addedAt.toISOString(),
            })),
            updatedAt: reloadedGuest.updatedAt.toISOString(),
            version: 2,
          }),
        ),
      multi: jest.fn().mockReturnValue({ setex, del, exec }),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      duplicate: jest.fn().mockReturnValue(transaction),
    } as unknown as Redis;

    const result = await new CartRedisRepository(redis).mergeGuestCart(
      'user-1',
      guestCart,
      idempotencyKey,
    );

    expect(result.version).toBe(1);
    expect(result.items.map((item) => item.productId)).toEqual(['product-2']);
    expect(transaction.watch).toHaveBeenNthCalledWith(
      1,
      'cart:user-1',
      'cart:guest:session-1',
    );
    expect(transaction.watch).toHaveBeenNthCalledWith(
      2,
      'cart:user-1',
      'cart:guest:session-1',
    );
    expect(transaction.get).toHaveBeenNthCalledWith(1, 'cart:user-1');
    expect(transaction.get).toHaveBeenNthCalledWith(2, 'cart:guest:session-1');
    expect(transaction.get).toHaveBeenNthCalledWith(3, 'cart:user-1');
    expect(transaction.get).toHaveBeenNthCalledWith(4, 'cart:guest:session-1');
    expect(exec).toHaveBeenCalledTimes(2);
    expect(setex).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(1);
    expect(transaction.quit).toHaveBeenCalledTimes(1);
  });

  it('propagates merge command errors and always quits the duplicate connection', async () => {
    const commandError = new Error('Redis merge write failed');
    const transaction = {
      watch: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      multi: jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[commandError, null]]),
      }),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      duplicate: jest.fn().mockReturnValue(transaction),
    } as unknown as Redis;

    await expect(
      new CartRedisRepository(redis).mergeGuestCart(
        'user-1',
        Cart.create('guest:session-1'),
        'merge-1',
      ),
    ).rejects.toBe(commandError);
    expect(transaction.quit).toHaveBeenCalledTimes(1);
  });

  it('restores the observed guest payload without overwriting newer data after a partial merge failure', async () => {
    const commandError = new Error('Redis merge write failed');
    const guestPayload = JSON.stringify({
      userId: 'guest:session-1',
      items: [],
      updatedAt: '2026-08-18T09:00:00.000Z',
      version: 4,
    });
    const setnx = jest.fn().mockResolvedValue(1);
    const expire = jest.fn().mockResolvedValue(1);
    const transaction = {
      watch: jest.fn().mockResolvedValue('OK'),
      get: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(guestPayload),
      multi: jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [commandError, null],
          [null, 1],
        ]),
      }),
      setnx,
      expire,
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      duplicate: jest.fn().mockReturnValue(transaction),
    } as unknown as Redis;

    await expect(
      new CartRedisRepository(redis).mergeGuestCart(
        'user-1',
        Cart.create('guest:session-1'),
        'merge-1',
      ),
    ).rejects.toBe(commandError);

    expect(setnx).toHaveBeenCalledWith('cart:guest:session-1', guestPayload);
    expect(expire).toHaveBeenCalledWith(
      'cart:guest:session-1',
      30 * 24 * 60 * 60,
    );
    expect(transaction.quit).toHaveBeenCalledTimes(1);
  });
});
