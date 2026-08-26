import { Cart } from '../domain/cart';
import { CartItem } from '../domain/cart-item';
import { Money } from '../domain/money';
import type { CartItemResponse } from './cart-item.response';
import type { CartResponse } from './cart.response';
import type { MoneyResponse } from './money.response';

function toMoneyResponse(money: Money): MoneyResponse {
  return {
    amount: money.amount,
    currency: money.currency,
  };
}

function toCartItemResponse(item: CartItem): CartItemResponse {
  return {
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    productImage: item.productImage,
    unitPrice: toMoneyResponse(item.unitPrice),
    quantity: item.quantity,
    subtotal: toMoneyResponse(item.subtotal),
    parcel: item.parcel,
    parcelSnapshot: item.parcel,
    addedAt: item.addedAt.toISOString(),
    sellerId: item.sellerId,
    sellerName: item.sellerName,
  };
}

export function toCartResponse(cart: Cart): CartResponse {
  return {
    userId: cart.userId,
    items: cart.items.map(toCartItemResponse),
    itemCount: cart.itemCount,
    uniqueItemCount: cart.uniqueItemCount,
    totalAmount: toMoneyResponse(cart.totalAmount),
    updatedAt: cart.updatedAt.toISOString(),
  };
}
