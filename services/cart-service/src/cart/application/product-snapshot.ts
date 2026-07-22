import { Money } from '../domain/money';

export interface ProductSnapshot {
  productId: string;
  productName: string;
  productImage: string;
  unitPrice: Money;
  sellerId?: string;
  sellerName?: string;
}
