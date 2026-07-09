import { ProductNotFoundException } from '../domain/product-not-found.exception';
import { Money } from '../domain/money';
import type { ProductClientPort } from '../application/product-client.port';
import type { ProductSnapshot } from '../application/product-snapshot';
import CircuitBreaker from 'opossum';

// product-service ProductResponse — the actual wire shape today.
// Top-level price/image do NOT exist; they live under variants[] and images[].
// See services/product-service/.../ProductResponse.java.
interface ProductServiceVariant {
  sku?: string;
  name?: string;
  priceAmount?: number;
  priceCurrency?: string;
  imageUrl?: string;
  stockQuantity?: number;
}

interface ProductServiceImage {
  url?: string;
  alt?: string;
  sortOrder?: number;
}

interface ProductServiceResponse {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  // Legacy/optional top-level fields kept for tolerance — newer
  // product-service builds may surface a flat price for read-models.
  image?: string;
  productImage?: string;
  price?: number | { amount: number; currency?: string };
  unitPrice?: number | { amount: number; currency?: string };
  currency?: string;
  // Real fields on the live BE.
  variants?: ProductServiceVariant[];
  images?: ProductServiceImage[];
}

function pickPrice(product: ProductServiceResponse): {
  amount: number;
  currency: string;
} {
  // 1. Flat top-level price (legacy or future read-model shape).
  const flat = product.unitPrice ?? product.price;
  if (typeof flat === 'number') {
    return { amount: flat, currency: product.currency ?? 'VND' };
  }
  if (flat && typeof flat === 'object' && typeof flat.amount === 'number') {
    return {
      amount: flat.amount,
      currency: flat.currency ?? product.currency ?? 'VND',
    };
  }
  // 2. First variant — this is what product-service actually returns today.
  const variant = product.variants?.[0];
  if (variant && typeof variant.priceAmount === 'number') {
    return {
      amount: variant.priceAmount,
      currency: variant.priceCurrency ?? 'VND',
    };
  }
  return { amount: 0, currency: product.currency ?? 'VND' };
}

function pickImage(product: ProductServiceResponse): string {
  if (product.productImage) return product.productImage;
  if (product.image) return product.image;
  // product-service surfaces images[] (sortOrder ascending) and variants[].imageUrl.
  const sorted = (product.images ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (sorted[0]?.url) return sorted[0].url;
  return product.variants?.[0]?.imageUrl ?? '';
}

export class ProductHttpClientAdapter implements ProductClientPort {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly productServiceUrl: string | undefined;

  constructor(productServiceUrl?: string) {
    this.productServiceUrl = productServiceUrl;
    // Configure circuit breaker with sensible defaults
    this.circuitBreaker = new CircuitBreaker(this.fetchProduct.bind(this), {
      timeout: 3000, // If product service doesn't respond in 3s, trip the circuit
      errorThresholdPercentage: 50, // Trip circuit if 50% of requests fail
      resetTimeout: 30000, // Try to reopen circuit after 30s
      volumeThreshold: 5, // Need at least 5 requests before evaluating
    });
  }

  private async fetchProduct(productId: string): Promise<ProductServiceResponse> {
    if (!this.productServiceUrl) {
      throw new ProductNotFoundException(productId);
    }

    const response = await fetch(
      `${this.productServiceUrl}/products/${productId}`,
    );

    if (response.status === 404) {
      throw new ProductNotFoundException(productId);
    }

    if (!response.ok) {
      throw new ProductNotFoundException(productId);
    }

    const payload = (await response.json()) as
      | ProductServiceResponse
      | { data: ProductServiceResponse };
    return 'data' in payload ? payload.data : payload;
  }

  async getSnapshot(productId: string): Promise<ProductSnapshot> {
    if (!this.productServiceUrl) {
      return {
        productId,
        productName: productId,
        productImage: '',
        unitPrice: Money.zero('VND'),
      };
    }

    try {
      const product = (await this.circuitBreaker.fire(productId)) as ProductServiceResponse;
      const { amount, currency } = pickPrice(product);

      return {
        productId: product.productId ?? product.id ?? productId,
        productName: product.productName ?? product.name ?? productId,
        productImage: pickImage(product),
        unitPrice: Money.of(amount, currency),
      };
    } catch (error) {
      // Re-throw ProductNotFoundException so callers can handle 404s properly
      if (error instanceof ProductNotFoundException) {
        throw error;
      }
      // Circuit breaker open or other failure - return fallback
      return {
        productId,
        productName: productId,
        productImage: '',
        unitPrice: Money.zero('VND'),
      };
    }
  }
}
