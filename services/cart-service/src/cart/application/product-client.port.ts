import type { ProductSnapshot } from './product-snapshot';

export interface ProductClientPort {
  getSnapshot(productId: string, variantId?: string | null): Promise<ProductSnapshot>;
}
