import type { MoneyResponse } from './money.response';

export interface CartItemResponse {
  productId: string;
  variantId: string | null;
  productName: string;
  productImage: string;
  unitPrice: MoneyResponse;
  quantity: number;
  subtotal: MoneyResponse;
  addedAt: string;
  sellerId?: string;
  sellerName?: string;
}
