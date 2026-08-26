import type { MoneyResponse } from './money.response';
import type { ParcelDimensions } from '../domain/parcel-dimensions';

export interface CartItemResponse {
  productId: string;
  variantId: string | null;
  productName: string;
  productImage: string;
  unitPrice: MoneyResponse;
  quantity: number;
  subtotal: MoneyResponse;
  parcel: ParcelDimensions | null;
  parcelSnapshot: ParcelDimensions | null;
  addedAt: string;
  sellerId?: string;
  sellerName?: string;
}
