import { randomUUID } from 'node:crypto';
import { CartFullException } from './cart-full.exception';
import { CartItemLimitExceededException } from './cart-item-limit-exceeded.exception';
import { CartItemNotFoundException } from './cart-item-not-found.exception';
import { InvalidCartOperationException } from './invalid-cart-operation.exception';
import { CartItem } from './cart-item';
import { Money } from './money';

export class Cart {
  static readonly MAX_ITEMS = 99;
  static readonly MAX_PER_ITEM = 10;

  private constructor(
    public readonly userId: string,
    private _items: CartItem[],
    private _updatedAt: Date,
    private _version: number,
    private readonly _generationId: string,
  ) {}

  static create(userId: string): Cart {
    if (!userId) {
      throw new InvalidCartOperationException('userId required');
    }

    return new Cart(userId, [], new Date(), 0, randomUUID());
  }

  static fromPersistence(
    userId: string,
    items: CartItem[],
    updatedAt: Date,
    version = 1,
    generationId = Cart.legacyGenerationId(userId),
  ): Cart {
    return new Cart(userId, items, updatedAt, version, generationId);
  }

  get items(): readonly CartItem[] {
    return this._items;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get version(): number {
    return this._version;
  }

  get generationId(): string {
    return this._generationId;
  }

  private static legacyGenerationId(userId: string): string {
    return `legacy:${userId}`;
  }

  markPersisted(version: number): void {
    this._version = version;
  }

  get itemCount(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get uniqueItemCount(): number {
    return this._items.length;
  }

  get totalAmount(): Money {
    return this._items.reduce(
      (total, item) => total.add(item.subtotal),
      Money.zero('VND'),
    );
  }

  get isEmpty(): boolean {
    return this._items.length === 0;
  }

  addItem(item: CartItem): void {
    const existing = this._items.find(
      (cartItem) => cartItem.itemKey === item.itemKey,
    );

    if (existing) {
      const quantity = existing.quantity + item.quantity;
      if (quantity > Cart.MAX_PER_ITEM) {
        throw new CartItemLimitExceededException(
          item.itemKey,
          Cart.MAX_PER_ITEM,
          quantity,
        );
      }

      existing.updateQuantity(quantity);
      const parcel = item.parcel;
      if (parcel !== null) {
        this._items = this._items.map((cartItem) =>
          cartItem === existing ? existing.withParcel(parcel) : cartItem,
        );
      }
    } else {
      if (this._items.length >= Cart.MAX_ITEMS) {
        throw new CartFullException(Cart.MAX_ITEMS);
      }

      if (item.quantity > Cart.MAX_PER_ITEM) {
        throw new CartItemLimitExceededException(
          item.itemKey,
          Cart.MAX_PER_ITEM,
          item.quantity,
        );
      }

      this._items = [...this._items, item];
    }

    this._updatedAt = new Date();
  }

  removeItem(itemKey: string): void {
    const originalLength = this._items.length;
    this._items = this._items.filter((item) => item.itemKey !== itemKey);

    if (this._items.length === originalLength) {
      throw new CartItemNotFoundException(itemKey);
    }

    this._updatedAt = new Date();
  }

  updateItemQuantity(itemKey: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemKey);
      return;
    }

    if (quantity > Cart.MAX_PER_ITEM) {
      throw new CartItemLimitExceededException(
        itemKey,
        Cart.MAX_PER_ITEM,
        quantity,
      );
    }

    const item = this._items.find((cartItem) => cartItem.itemKey === itemKey);
    if (!item) {
      throw new CartItemNotFoundException(itemKey);
    }

    item.updateQuantity(quantity);
    this._updatedAt = new Date();
  }

  clear(): void {
    this._items = [];
    this._updatedAt = new Date();
  }

  replaceParcel(itemKey: string, parcel: CartItem['parcel']): boolean {
    const item = this._items.find((cartItem) => cartItem.itemKey === itemKey);
    if (!item) {
      return false;
    }

    const current = item.parcel;
    const unchanged =
      current === parcel ||
      (current !== null &&
        parcel !== null &&
        current.weightGrams === parcel.weightGrams &&
        current.lengthCm === parcel.lengthCm &&
        current.widthCm === parcel.widthCm &&
        current.heightCm === parcel.heightCm);
    if (unchanged) {
      return false;
    }

    this._items = this._items.map((cartItem) =>
      cartItem === item ? item.withParcel(parcel) : cartItem,
    );
    this._updatedAt = new Date();
    return true;
  }
}
