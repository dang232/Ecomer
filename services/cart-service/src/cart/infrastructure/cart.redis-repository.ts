import Redis from 'ioredis';
import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import type { CartRepository, ParcelPatch } from '../domain/cart.repository';
import { Money } from '../domain/money';
import type { ParcelDimensions } from '../domain/parcel-dimensions';

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

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const MAX_REFRESH_ATTEMPTS = 5;
const MAX_MERGE_ATTEMPTS = 5;

export class CartRedisRepository implements CartRepository {
  constructor(private readonly redis: Redis) {}

  async findByUserId(userId: string): Promise<Cart | null> {
    const value = await this.redis.get(this.key(userId));

    if (!value) {
      return null;
    }

    return this.fromPersistence(JSON.parse(value) as PersistedCart);
  }

  async save(cart: Cart, ttlSeconds: number): Promise<void> {
    const transactionRedis = this.redis.duplicate();
    try {
      const userKey = this.key(cart.userId);
      await transactionRedis.watch(userKey);
      const current = await transactionRedis.get(userKey);
      const persisted = current ? (JSON.parse(current) as PersistedCart) : null;
      const currentVersion = persisted?.version ?? (persisted ? 1 : 0);
      if (
        cart.version === 0
          ? persisted !== null
          : currentVersion !== cart.version
      ) {
        throw this.versionConflict();
      }

      const nextVersion = cart.version + 1;
      const results = await transactionRedis
        .multi()
        .setex(
          userKey,
          ttlSeconds,
          JSON.stringify(
            this.toPersistence(
              cart,
              persisted?.processedMergeKeys ?? [],
              nextVersion,
            ),
          ),
        )
        .exec();
      if (results === null) {
        throw new Error('Concurrent cart mutation was aborted');
      }
      this.assertCommandResults(results);
      cart.markPersisted(nextVersion);
    } finally {
      await transactionRedis.quit();
    }
  }

  async refreshParcels(
    userId: string,
    patches: readonly ParcelPatch[],
  ): Promise<Cart> {
    const userKey = this.key(userId);
    const transactionRedis = this.redis.duplicate();

    try {
      for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt += 1) {
        await transactionRedis.watch(userKey);
        const current = await transactionRedis.get(userKey);
        const cart = current
          ? this.fromPersistence(JSON.parse(current) as PersistedCart)
          : Cart.create(userId);
        const changed = patches.reduce(
          (hasChanged, patch) =>
            cart.replaceParcel(patch.itemKey, patch.parcel) || hasChanged,
          false,
        );

        if (!changed) {
          await transactionRedis.unwatch();
          return cart;
        }

        const results = await transactionRedis
          .multi()
          .setex(
            userKey,
            THIRTY_DAYS_SECONDS,
            JSON.stringify(
              this.toPersistence(
                cart,
                current
                  ? ((JSON.parse(current) as PersistedCart)
                      .processedMergeKeys ?? [])
                  : [],
                cart.version + 1,
              ),
            ),
          )
          .exec();

        if (results !== null) {
          this.assertCommandResults(results);
          cart.markPersisted(cart.version + 1);
          return cart;
        }
      }
    } finally {
      await transactionRedis.quit();
    }

    throw new Error('Concurrent cart parcel refresh was aborted');
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  async mergeGuestCart(
    userId: string,
    guestCart: Cart,
    idempotencyKey: string,
  ): Promise<Cart> {
    const userKey = this.key(userId);
    const guestKey = this.key(guestCart.userId);
    const transactionRedis = this.redis.duplicate();

    try {
      for (let attempt = 0; attempt < MAX_MERGE_ATTEMPTS; attempt += 1) {
        await transactionRedis.watch(userKey, guestKey);
        const [current, guestCurrent] = await Promise.all([
          transactionRedis.get(userKey),
          transactionRedis.get(guestKey),
        ]);
        const persisted = current
          ? (JSON.parse(current) as PersistedCart)
          : null;
        const persistedGuest = guestCurrent
          ? (JSON.parse(guestCurrent) as PersistedCart)
          : null;
        const processedMergeKeys = persisted?.processedMergeKeys ?? [];
        const userCart = persisted
          ? this.fromPersistence(persisted)
          : Cart.create(userId);

        if (processedMergeKeys.includes(idempotencyKey)) {
          await transactionRedis.unwatch();
          return userCart;
        }

        const mergeSource = persistedGuest
          ? this.fromPersistence(persistedGuest)
          : guestCart;
        for (const item of mergeSource.items) {
          userCart.addItem(item);
        }

        const transaction = transactionRedis
          .multi()
          .setex(
            userKey,
            THIRTY_DAYS_SECONDS,
            JSON.stringify(
              this.toPersistence(
                userCart,
                [...processedMergeKeys, idempotencyKey].slice(-100),
                userCart.version + 1,
              ),
            ),
          );
        if (guestCurrent !== null) {
          transaction.del(guestKey);
        }
        const results = await transaction.exec();

        if (results === null) {
          continue;
        }
        const commandError = this.commandError(results);
        if (commandError !== null) {
          if (guestCurrent !== null) {
            await this.restoreGuestSnapshot(
              transactionRedis,
              guestKey,
              guestCurrent,
            );
          }
          throw commandError;
        }
        userCart.markPersisted(userCart.version + 1);
        return userCart;
      }
    } finally {
      await transactionRedis.quit();
    }

    throw new Error('Concurrent cart merge was aborted');
  }

  private key(userId: string): string {
    return `cart:${userId}`;
  }

  private fromPersistence(persisted: PersistedCart): Cart {
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
        item.parcel ?? null,
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

  private toPersistence(
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

  private assertCommandResults(results: [Error | null, unknown][]): void {
    const commandError = this.commandError(results);
    if (commandError !== null) {
      throw commandError;
    }
  }

  private commandError(results: [Error | null, unknown][]): Error | null {
    return results.find(([error]) => error !== null)?.[0] ?? null;
  }

  private async restoreGuestSnapshot(
    redis: Redis,
    guestKey: string,
    payload: string,
  ): Promise<void> {
    try {
      const restored = await redis.setnx(guestKey, payload);
      if (restored === 1) {
        await redis.expire(guestKey, THIRTY_DAYS_SECONDS);
      }
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        return;
      }
      return;
    }
  }

  private versionConflict(): Error {
    const conflict = new Error('Concurrent cart modification detected');
    (conflict as NodeJS.ErrnoException).code = 'CART_VERSION_CONFLICT';
    return conflict;
  }
}
