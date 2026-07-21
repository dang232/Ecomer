import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, LockMode, OptimisticLockError } from '@mikro-orm/core';
import Redis from 'ioredis';
import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { CartRepository } from '../domain/cart.repository';
import { Money } from '../domain/money';
import { CartMikroOrmEntity } from './cart.mikro-orm-entity.js';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

interface PersistedMoney {
  amount: number;
  currency: string;
}

interface PersistedCartItem {
  productId: string;
  variantId: string | null;
  productName: string;
  productImage: string;
  unitPrice: PersistedMoney;
  quantity: number;
  addedAt: string;
}

interface PersistedCart {
  userId: string;
  items: PersistedCartItem[];
  updatedAt: string;
  processedMergeKeys?: string[];
}

/**
 * Cache-aside repository: Postgres is the source of truth.
 * Read path:  Redis hit → return; Redis miss → read Postgres → populate Redis.
 * Write path: Write Postgres first → invalidate Redis key.
 * Optimistic locking via MikroORM @Version() — throws 409 on stale version.
 */
@Injectable()
export class CartPersistenceService implements CartRepository {
  private readonly logger = new Logger(CartPersistenceService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly redis: Redis,
  ) {}

  async findByUserId(userId: string): Promise<Cart | null> {
    const cached = await this.getFromRedis(userId);
    if (cached !== null) {
      return cached;
    }

    const entity = await this.em.fork().findOne(CartMikroOrmEntity, { userId });
    if (!entity) {
      return null;
    }

    const cart = this.toDomain(entity);
    await this.setInRedis(userId, cart).catch((err: unknown) =>
      this.logger.warn(`Redis write failed (non-fatal): ${String(err)}`),
    );
    return cart;
  }

  async save(cart: Cart, _ttlSeconds: number): Promise<void> {
    const em = this.em.fork();

    try {
      const existing = await em.findOne(CartMikroOrmEntity, {
        userId: cart.userId,
      });

      if (existing) {
        existing.items = this.itemsToJson(cart);
        existing.updatedAt = cart.updatedAt;
        await em.flush();
      } else {
        const entity = em.create(CartMikroOrmEntity, {
          userId: cart.userId,
          items: this.itemsToJson(cart),
          updatedAt: cart.updatedAt,
          version: 1,
        });
        await em.persistAndFlush(entity);
      }
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        const conflict = new Error('Concurrent cart modification detected');
        (conflict as NodeJS.ErrnoException).code = 'CART_VERSION_CONFLICT';
        throw conflict;
      }
      throw err;
    }

    // Invalidate cache after successful Postgres write
    await this.redis
      .del(this.redisKey(cart.userId))
      .catch((err: unknown) =>
        this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`),
      );
  }

  async delete(userId: string): Promise<void> {
    const em = this.em.fork();
    const entity = await em.findOne(CartMikroOrmEntity, { userId });
    if (entity) {
      await em.removeAndFlush(entity);
    }

    await this.redis
      .del(this.redisKey(userId))
      .catch((err: unknown) =>
        this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`),
      );
  }

  /**
   * Persist the merged user cart and remove its guest source in one database
   * transaction. The processed key is stored with the user cart so a retried
   * request returns the prior cart instead of adding quantities again.
   */
  async mergeGuestCart(
    userId: string,
    guestCart: Cart,
    idempotencyKey: string,
  ): Promise<Cart> {
    const guestUserId = guestCart.userId;
    const merged = await this.em.transactional(async (em) => {
      const userEntity = await em.findOne(
        CartMikroOrmEntity,
        { userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      const priorMergeKeys = this.processedMergeKeys(userEntity);
      if (priorMergeKeys.includes(idempotencyKey)) {
        return userEntity ? this.toDomain(userEntity) : Cart.create(userId);
      }

      let guestEntity = await em.findOne(
        CartMikroOrmEntity,
        { userId: guestUserId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!guestEntity) {
        guestEntity = em.create(CartMikroOrmEntity, {
          userId: guestUserId,
          items: this.itemsToJson(guestCart),
          updatedAt: guestCart.updatedAt,
          version: 1,
        });
        await em.persistAndFlush(guestEntity);
      }

      const userCart = userEntity ? this.toDomain(userEntity) : Cart.create(userId);
      const persistedGuest = this.toDomain(guestEntity);
      for (const item of persistedGuest.items) {
        userCart.addItem(item);
      }

      const processedMergeKeys = [...priorMergeKeys, idempotencyKey].slice(-100);
      if (userEntity) {
        userEntity.items = this.itemsToJson(userCart, processedMergeKeys);
        userEntity.updatedAt = userCart.updatedAt;
      } else {
        await em.persist(
          em.create(CartMikroOrmEntity, {
            userId,
            items: this.itemsToJson(userCart, processedMergeKeys),
            updatedAt: userCart.updatedAt,
            version: 1,
          }),
        );
      }
      em.remove(guestEntity);
      await em.flush();
      return userCart;
    });

    await Promise.all(
      [userId, guestUserId].map((ownerId) =>
        this.redis.del(this.redisKey(ownerId)).catch((err: unknown) =>
          this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`),
        ),
      ),
    );
    return merged;
  }

  private async getFromRedis(userId: string): Promise<Cart | null> {
    try {
      const value = await this.redis.get(this.redisKey(userId));
      if (!value) return null;
      return this.deserializeCart(JSON.parse(value) as PersistedCart);
    } catch (err) {
      this.logger.warn(`Redis read failed (falling through to Postgres): ${String(err)}`);
      return null;
    }
  }

  private async setInRedis(userId: string, cart: Cart): Promise<void> {
    const payload: PersistedCart = {
      userId: cart.userId,
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        productImage: item.productImage,
        unitPrice: { amount: item.unitPrice.amount, currency: item.unitPrice.currency },
        quantity: item.quantity,
        addedAt: item.addedAt.toISOString(),
      })),
      updatedAt: cart.updatedAt.toISOString(),
    };
    await this.redis.setex(
      this.redisKey(userId),
      THIRTY_DAYS_SECONDS,
      JSON.stringify(payload),
    );
  }

  private redisKey(userId: string): string {
    return `cart:${userId}`;
  }

  private toDomain(entity: CartMikroOrmEntity): Cart {
    const persisted = entity.items as PersistedCart;
    const items = (persisted.items ?? []).map((item) =>
      CartItem.fromPersistence(
        item.productId,
        item.productName,
        item.productImage,
        Money.of(item.unitPrice.amount, item.unitPrice.currency),
        item.quantity,
        new Date(item.addedAt),
        item.variantId,
      ),
    );
    return Cart.fromPersistence(entity.userId, items, entity.updatedAt);
  }

  private deserializeCart(persisted: PersistedCart): Cart {
    const items = persisted.items.map((item) =>
      CartItem.fromPersistence(
        item.productId,
        item.productName,
        item.productImage,
        Money.of(item.unitPrice.amount, item.unitPrice.currency),
        item.quantity,
        new Date(item.addedAt),
        item.variantId,
      ),
    );
    return Cart.fromPersistence(
      persisted.userId,
      items,
      new Date(persisted.updatedAt),
    );
  }

  private processedMergeKeys(entity: CartMikroOrmEntity | null): string[] {
    if (!entity || !entity.items || typeof entity.items !== 'object') return [];
    const keys = (entity.items as PersistedCart).processedMergeKeys;
    return Array.isArray(keys) && keys.every((key) => typeof key === 'string') ? keys : [];
  }

  private itemsToJson(cart: Cart, processedMergeKeys?: string[]): PersistedCart {
    return {
      userId: cart.userId,
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        productImage: item.productImage,
        unitPrice: { amount: item.unitPrice.amount, currency: item.unitPrice.currency },
        quantity: item.quantity,
        addedAt: item.addedAt.toISOString(),
      })),
      updatedAt: cart.updatedAt.toISOString(),
      ...(processedMergeKeys ? { processedMergeKeys } : {}),
    };
  }
}
