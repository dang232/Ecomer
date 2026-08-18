import { ProductNotFoundException } from '../domain/product-not-found.exception';
import { VariantNotFoundException } from '../domain/variant-not-found.exception';
import { Money } from '../domain/money';
import type { ProductClientPort } from '../application/product-client.port';
import type { ProductSnapshot } from '../application/product-snapshot';
import type { ParcelDimensions } from '../domain/parcel-dimensions';
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
  parcel?: ProductServiceParcel | null;
}

interface ProductServiceParcel {
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

interface ProductServiceImage {
  url?: string;
  alt?: string;
  sortOrder?: number;
}

interface ProductServiceResponse {
  id?: string;
  productId?: string;
  sellerId?: string;
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

function pickPrice(
  product: ProductServiceResponse,
  variantId?: string | null,
): { amount: number; currency: string } {
  // 1. Specific variant by ID — throw if explicitly requested but not found.
  if (variantId && product.variants) {
    const matched = product.variants.find((v) => v.sku === variantId);
    if (matched) {
      if (typeof matched.priceAmount === 'number') {
        return { amount: matched.priceAmount, currency: matched.priceCurrency ?? 'VND' };
      }
      return { amount: 0, currency: matched.priceCurrency ?? 'VND' };
    }
    // variantId provided but not found — reject, don't silently fall back.
    throw new VariantNotFoundException(product.productId ?? product.id ?? '(unknown)', variantId);
  }
  // 2. Flat top-level price (legacy or future read-model shape).
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
  // 3. First variant fallback (no explicit variantId requested).
  const variant = product.variants?.[0];
  if (variant && typeof variant.priceAmount === 'number') {
    return { amount: variant.priceAmount, currency: variant.priceCurrency ?? 'VND' };
  }
  return { amount: 0, currency: product.currency ?? 'VND' };
}

function pickImage(product: ProductServiceResponse, variantId?: string | null): string {
  // 1. Variant-specific image by ID — throw only if variant is explicitly wrong.
  if (variantId && product.variants) {
    const matched = product.variants.find((v) => v.sku === variantId);
    if (matched?.imageUrl) return matched.imageUrl;
    // Variant exists but has no image — fall back to product-level images below.
    // Only throw if the variantId doesn't exist at all.
    if (!matched) {
      throw new VariantNotFoundException(product.productId ?? product.id ?? '(unknown)', variantId);
    }
  }
  // 2. Top-level legacy fields.
  if (product.productImage) return product.productImage;
  if (product.image) return product.image;
  // 3. First image in sorted array.
  const sorted = (product.images ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (sorted[0]?.url) return sorted[0].url;
  return product.variants?.[0]?.imageUrl ?? '';
}

function parseParcel(parcel: ProductServiceParcel | null | undefined): ParcelDimensions | null {
  if (
    parcel?.weightGrams === undefined ||
    parcel.lengthCm === undefined ||
    parcel.widthCm === undefined ||
    parcel.heightCm === undefined
  ) {
    return null;
  }

  if (
    !Number.isInteger(parcel.weightGrams) ||
    !Number.isInteger(parcel.lengthCm) ||
    !Number.isInteger(parcel.widthCm) ||
    !Number.isInteger(parcel.heightCm) ||
    parcel.weightGrams <= 0 ||
    parcel.lengthCm <= 0 ||
    parcel.widthCm <= 0 ||
    parcel.heightCm <= 0
  ) {
    return null;
  }

  return {
    weightGrams: parcel.weightGrams,
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
  };
}

function pickParcel(
  product: ProductServiceResponse,
  variantId?: string | null,
): ParcelDimensions | null {
  if (variantId && product.variants) {
    const matched = product.variants.find((variant) => variant.sku === variantId);
    if (!matched) {
      throw new VariantNotFoundException(product.productId ?? product.id ?? '(unknown)', variantId);
    }
    return parseParcel(matched.parcel);
  }

  return parseParcel(product.variants?.[0]?.parcel);
}

export class ProductHttpClientAdapter implements ProductClientPort {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly productServiceUrl: string | undefined;
  private readonly userServiceUrl: string | undefined;
  private readonly userServiceTimeoutMs: number;

  constructor(productServiceUrl?: string, userServiceUrl?: string, userServiceTimeoutMs = 2000) {
    this.productServiceUrl = productServiceUrl;
    this.userServiceUrl = userServiceUrl;
    this.userServiceTimeoutMs = userServiceTimeoutMs;
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

  async getSnapshot(productId: string, variantId?: string | null): Promise<ProductSnapshot> {
    if (!this.productServiceUrl) {
      return {
        productId,
        productName: productId,
        productImage: '',
        unitPrice: Money.zero('VND'),
        parcel: null,
        degraded: true,
      };
    }

    try {
      const product = (await this.circuitBreaker.fire(productId)) as ProductServiceResponse;
      const { amount, currency } = pickPrice(product, variantId);

      return {
        productId: product.productId ?? product.id ?? productId,
        productName: product.productName ?? product.name ?? productId,
        productImage: pickImage(product, variantId),
        unitPrice: Money.of(amount, currency),
        parcel: pickParcel(product, variantId),
        sellerId: product.sellerId,
        sellerName: await this.fetchSellerName(product.sellerId),
      };
    } catch (error) {
      // Re-throw domain/validation exceptions — these indicate a bad request,
      // not an infrastructure outage. Let callers handle them explicitly.
      if (
        error instanceof VariantNotFoundException ||
        error instanceof ProductNotFoundException
      ) {
        throw error;
      }
      // Circuit breaker open or other infrastructure failure — return degraded
      // fallback so the cart stays accessible even when product-service is down.
      return {
        productId,
        productName: productId,
        productImage: '',
        unitPrice: Money.zero('VND'),
        parcel: null,
        degraded: true,
      };
    }
  }

  private async fetchSellerName(sellerId?: string): Promise<string | undefined> {
    if (!sellerId || !this.userServiceUrl) return undefined;
    try {
      const response = await fetch(`${this.userServiceUrl}/sellers/${encodeURIComponent(sellerId)}`, {
        signal: AbortSignal.timeout(this.userServiceTimeoutMs),
      });
      if (!response.ok) return undefined;
      const payload = (await response.json()) as { data?: { shopName?: string } };
      return payload.data?.shopName?.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
