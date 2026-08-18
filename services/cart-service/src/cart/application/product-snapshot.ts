import { Money } from '../domain/money';
import type { ParcelDimensions } from '../domain/parcel-dimensions';

export interface ProductSnapshot {
  productId: string;
  productName: string;
  productImage: string;
  unitPrice: Money;
  parcel: ParcelDimensions | null;
  degraded?: boolean;
  sellerId?: string;
  sellerName?: string;
}
