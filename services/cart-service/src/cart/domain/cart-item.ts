import { InvalidCartOperationException } from './invalid-cart-operation.exception';
import { Money } from './money';

export class CartItem {
  private constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly productImage: string,
    public readonly unitPrice: Money,
    private _quantity: number,
    public readonly addedAt: Date,
    private readonly _variantId: string | null,
    public readonly sellerId?: string,
    public readonly sellerName?: string,
  ) {}

  /** Returns the composite key used to distinguish line items in a cart. */
  static computeKey(productId: string, variantId: string | null): string {
    return variantId ? `${productId}:${variantId}` : productId;
  }

  static create(
    productId: string,
    productName: string,
    productImage: string,
    unitPrice: Money,
    quantity: number,
    variantId?: string | null,
    sellerId?: string,
    sellerName?: string,
  ): CartItem {
    if (quantity < 1) {
      throw new InvalidCartOperationException(
        'Quantity must be greater than or equal to 1',
      );
    }

    if (!productId) {
      throw new InvalidCartOperationException('productId required');
    }

    return new CartItem(
      productId,
      productName,
      productImage,
      unitPrice,
      quantity,
      new Date(),
      variantId ?? null,
      sellerId,
      sellerName,
    );
  }

  static fromPersistence(
    productId: string,
    productName: string,
    productImage: string,
    unitPrice: Money,
    quantity: number,
    addedAt: Date,
    variantId?: string | null,
    sellerId?: string,
    sellerName?: string,
  ): CartItem {
    return new CartItem(
      productId,
      productName,
      productImage,
      unitPrice,
      quantity,
      addedAt,
      variantId ?? null,
      sellerId,
      sellerName,
    );
  }

  get variantId(): string | null {
    return this._variantId;
  }

  /** Composite key that uniquely identifies this line item (productId:variantId or productId). */
  get itemKey(): string {
    return CartItem.computeKey(this.productId, this._variantId);
  }

  get quantity(): number {
    return this._quantity;
  }

  get subtotal(): Money {
    return this.unitPrice.multiply(this._quantity);
  }

  updateQuantity(quantity: number): void {
    this._quantity = quantity;
  }
}
