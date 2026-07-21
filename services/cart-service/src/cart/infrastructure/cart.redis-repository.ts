import Redis from 'ioredis';
import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { CartRepository } from '../domain/cart.repository';
import { Money } from '../domain/money';

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

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

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
    await this.redis.setex(
      this.key(cart.userId),
      ttlSeconds,
      JSON.stringify(this.toPersistence(cart)),
    );
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
    const current = await this.redis.get(userKey);
    const persisted = current ? (JSON.parse(current) as PersistedCart) : null;
    const processedMergeKeys = persisted?.processedMergeKeys ?? [];
    const userCart = persisted ? this.fromPersistence(persisted) : Cart.create(userId);

    if (processedMergeKeys.includes(idempotencyKey)) {
      return userCart;
    }

    for (const item of guestCart.items) {
      userCart.addItem(item);
    }

    const results = await this.redis
      .multi()
      .setex(
        userKey,
        THIRTY_DAYS_SECONDS,
        JSON.stringify(this.toPersistence(userCart, [...processedMergeKeys, idempotencyKey].slice(-100))),
      )
      .del(this.key(guestCart.userId))
      .exec();

    if (results === null) {
      throw new Error('Concurrent cart merge was aborted');
    }
    return userCart;
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
      ),
    );
    return Cart.fromPersistence(persisted.userId, items, new Date(persisted.updatedAt));
  }

  private toPersistence(cart: Cart, processedMergeKeys?: string[]): PersistedCart {
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
      })),
      updatedAt: cart.updatedAt.toISOString(),
      ...(processedMergeKeys ? { processedMergeKeys } : {}),
    };
  }
}
