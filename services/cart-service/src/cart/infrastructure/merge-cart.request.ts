export interface MergeCartRequest {
  sessionId: string;
  idempotencyKey: string;
  items: Array<{
    productId: string;
    quantity: number;
    variantId?: string;
  }>;
}
