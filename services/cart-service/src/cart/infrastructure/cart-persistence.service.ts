import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, LockMode, OptimisticLockError } from '@mikro-orm/core';
import Redis from 'ioredis';
import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository, ParcelPatch } from '../domain/cart.repository';
import { Money } from '../domain/money';
import type { ParcelDimensions } from '../domain/parcel-dimensions';
import { CartMikroOrmEntity } from './cart.mikro-orm-entity.js';
import {
  redisCacheHitsTotal,
  redisCacheMissesTotal,
  redisOperationDurationSeconds,
  redisEvictionsTotal,
} from '../../metrics';

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
  sellerId?: string;
  sellerName?: string;
  parcel?: ParcelDimensions | null;
  parcelSnapshot?: ParcelDimensions | null;
}

interface PersistedCart {
  userId: string;
  items: PersistedCartItem[];
  updatedAt: string;
  version?: number;
  generationId?: string;
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
    const started = process.hrtime.bigint();
    const cached = await this.getFromRedis(userId);
    redisOperationDurationSeconds.observe(
      { operation: 'get' },
      Number(process.hrtime.bigint() - started) / 1e9,
    );
    (cached === null ? redisCacheMissesTotal : redisCacheHitsTotal).inc();

    let loaded: { cart: Cart; version: number } | null;
    try {
      loaded = await this.em.transactional(async (em) => {
        await this.lockCart(em, userId);
        const entity = await em.findOne(
          CartMikroOrmEntity,
          { userId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!entity) {
          return null;
        }

        return { cart: this.toDomain(entity), version: entity.version ?? 1 };
      });
    } catch (err: unknown) {
      await this.redis
        .del(this.redisKey(userId))
        .catch((deleteErr: unknown) =>
          this.logger.warn(
            `Redis cleanup failed (non-fatal): ${String(deleteErr)}`,
          ),
        );
      this.logger.warn(
        `Postgres read failed (non-fatal cache cleanup): ${String(err)}`,
      );
      throw err;
    }

    if (loaded === null) {
      await this.redis
        .del(this.redisKey(userId))
        .catch((err: unknown) =>
          this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`),
        );
      return null;
    }

    if (
      cached !== null &&
      cached.version === loaded.version &&
      cached.generationId === loaded.cart.generationId
    ) {
      return cached;
    }

    try {
      await this.setInRedis(userId, loaded.cart);
    } catch (err: unknown) {
      await this.redis
        .del(this.redisKey(userId))
        .catch((deleteErr: unknown) =>
          this.logger.warn(
            `Redis cleanup failed (non-fatal): ${String(deleteErr)}`,
          ),
        );
      this.logger.warn(
        `Redis cache population failed (non-fatal): ${String(err)}`,
      );
      return loaded.cart;
    }

    let current: { version: number; generationId: string } | null;
    try {
      current = await this.em.transactional(async (em) => {
        await this.lockCart(em, userId);
        const entity = await em.findOne(
          CartMikroOrmEntity,
          { userId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        return entity
          ? {
              version: entity.version ?? 1,
              generationId: this.toDomain(entity).generationId,
            }
          : null;
      });
    } catch (err: unknown) {
      await this.redis
        .del(this.redisKey(userId))
        .catch((deleteErr: unknown) =>
          this.logger.warn(
            `Redis cleanup failed (non-fatal): ${String(deleteErr)}`,
          ),
        );
      this.logger.warn(`Postgres cache validation failed: ${String(err)}`);
      throw err;
    }

    try {
      if (
        current === null ||
        current.version !== loaded.version ||
        current.generationId !== loaded.cart.generationId
      ) {
        await this.redis.del(this.redisKey(userId));
      }
    } catch (err: unknown) {
      await this.redis
        .del(this.redisKey(userId))
        .catch((deleteErr: unknown) =>
          this.logger.warn(
            `Redis cleanup failed (non-fatal): ${String(deleteErr)}`,
          ),
        );
      this.logger.warn(
        `Redis cache validation cleanup failed (non-fatal): ${String(err)}`,
      );
    }

    return loaded.cart;
  }

  async save(cart: Cart, ttlSeconds: number): Promise<void> {
    void ttlSeconds;
    try {
      await this.em.transactional(async (em) => {
        await this.lockCart(em, cart.userId);
        const existing = await em.findOne(
          CartMikroOrmEntity,
          { userId: cart.userId },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );

        if (!existing) {
          if (cart.version !== 0) {
            throw this.versionConflict();
          }
          const entity = em.create(CartMikroOrmEntity, {
            userId: cart.userId,
            items: this.itemsToJson(cart, undefined, 1),
            updatedAt: cart.updatedAt,
            version: 1,
          });
          await em.persistAndFlush(entity);
          cart.markPersisted(entity.version);
          return;
        }

        if (cart.version !== existing.version) {
          throw this.versionConflict();
        }
        const processedMergeKeys = this.processedMergeKeys(existing);
        existing.items = this.itemsToJson(
          cart,
          processedMergeKeys,
          existing.version + 1,
        );
        existing.updatedAt = cart.updatedAt;
        await em.flush();
        cart.markPersisted(existing.version);
      });
    } catch (err) {
      if (err instanceof OptimisticLockError) {
        throw this.versionConflict();
      }
      throw err;
    }

    // Invalidate cache after successful Postgres write
    await this.redis
      .del(this.redisKey(cart.userId))
      .then(() =>
        redisEvictionsTotal.inc({
          operation: 'invalidate',
          outcome: 'success',
        }),
      )
      .catch(
        (err: unknown) => (
          redisEvictionsTotal.inc({
            operation: 'invalidate',
            outcome: 'failure',
          }),
          this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`)
        ),
      );
  }

  async refreshParcels(
    userId: string,
    patches: readonly ParcelPatch[],
  ): Promise<Cart> {
    const result = await this.em.transactional(async (em) => {
      await this.lockCart(em, userId);
      const entity = await em.findOne(
        CartMikroOrmEntity,
        { userId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!entity) {
        return { cart: Cart.create(userId), changed: false, found: false };
      }

      const cart = this.toDomain(entity);
      const changed = patches.reduce(
        (hasChanged, patch) =>
          cart.replaceParcel(patch.itemKey, patch.parcel) || hasChanged,
        false,
      );

      if (changed) {
        entity.items = this.itemsToJson(
          cart,
          this.processedMergeKeys(entity),
          entity.version + 1,
        );
        entity.updatedAt = cart.updatedAt;
        await em.flush();
        cart.markPersisted(entity.version);
      }

      return { cart, changed, found: true };
    });

    await this.redis
      .del(this.redisKey(userId))
      .catch((err: unknown) =>
        this.logger.warn(`Redis del failed (non-fatal): ${String(err)}`),
      );

    return result.cart;
  }

  async delete(userId: string): Promise<void> {
    await this.em.transactional(async (em) => {
      await this.lockCart(em, userId);
      const entity = await em.findOne(CartMikroOrmEntity, { userId });
      if (entity) {
        await em.removeAndFlush(entity);
      }
    });

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
      await this.lockCart(em, userId);
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
          items: this.itemsToJson(guestCart, undefined, 1),
          updatedAt: guestCart.updatedAt,
          version: 1,
        });
        await em.persistAndFlush(guestEntity);
      }

      const userCart = userEntity
        ? this.toDomain(userEntity)
        : Cart.create(userId);
      const persistedGuest = this.toDomain(guestEntity);
      for (const item of persistedGuest.items) {
        userCart.addItem(item);
      }

      const processedMergeKeys = [...priorMergeKeys, idempotencyKey].slice(
        -100,
      );
      if (userEntity) {
        userEntity.items = this.itemsToJson(
          userCart,
          processedMergeKeys,
          userEntity.version + 1,
        );
        userEntity.updatedAt = userCart.updatedAt;
      } else {
        em.persist(
          em.create(CartMikroOrmEntity, {
            userId,
            items: this.itemsToJson(userCart, processedMergeKeys, 1),
            updatedAt: userCart.updatedAt,
            version: 1,
          }),
        );
      }
      em.remove(guestEntity);
      await em.flush();
      if (userEntity) {
        userCart.markPersisted(userEntity.version);
      } else {
        userCart.markPersisted(1);
      }
      return userCart;
    });

    await Promise.all(
      [userId, guestUserId].map((ownerId) =>
        this.redis
          .del(this.redisKey(ownerId))
          .catch((err: unknown) =>
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
      const persisted = JSON.parse(value) as PersistedCart;
      if (typeof persisted.version !== 'number') {
        return null;
      }
      return this.deserializeCart(persisted);
    } catch (err) {
      this.logger.warn(
        `Redis read failed (falling through to Postgres): ${String(err)}`,
      );
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
        unitPrice: {
          amount: item.unitPrice.amount,
          currency: item.unitPrice.currency,
        },
        quantity: item.quantity,
        addedAt: item.addedAt.toISOString(),
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        parcel: item.parcel,
        parcelSnapshot: item.parcel,
      })),
      updatedAt: cart.updatedAt.toISOString(),
      version: cart.version,
      generationId: cart.generationId,
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
        item.sellerId,
        item.sellerName,
        item.parcelSnapshot ?? item.parcel ?? null,
      ),
    );
    return Cart.fromPersistence(
      entity.userId,
      items,
      entity.updatedAt,
      entity.version ?? 1,
      persisted.generationId,
    );
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
        item.sellerId,
        item.sellerName,
        item.parcelSnapshot ?? item.parcel ?? null,
      ),
    );
    return Cart.fromPersistence(
      persisted.userId,
      items,
      new Date(persisted.updatedAt),
      persisted.version ?? 1,
      persisted.generationId,
    );
  }

  private async lockCart(em: EntityManager, userId: string): Promise<void> {
    await em
      .getConnection()
      .execute('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
        userId,
      ]);
  }

  private versionConflict(): Error {
    const conflict = new Error('Concurrent cart modification detected');
    (conflict as NodeJS.ErrnoException).code = 'CART_VERSION_CONFLICT';
    return conflict;
  }

  private processedMergeKeys(entity: CartMikroOrmEntity | null): string[] {
    if (!entity || !entity.items || typeof entity.items !== 'object') return [];
    const keys = (entity.items as PersistedCart).processedMergeKeys;
    return Array.isArray(keys) && keys.every((key) => typeof key === 'string')
      ? keys
      : [];
  }

  private itemsToJson(
    cart: Cart,
    processedMergeKeys?: string[],
    version = cart.version,
  ): PersistedCart {
    return {
      userId: cart.userId,
      items: cart.items.map((item) => ({
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
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        parcel: item.parcel,
        parcelSnapshot: item.parcel,
      })),
      updatedAt: cart.updatedAt.toISOString(),
      version,
      generationId: cart.generationId,
      ...(processedMergeKeys ? { processedMergeKeys } : {}),
    };
  }
}
