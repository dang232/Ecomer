import type { APIResponse } from "@playwright/test";

export interface AuthResponse {
  data?: {
    accessToken?: string;
    userId?: string;
  };
  accessToken?: string;
}

export interface ProductVariant {
  sku?: string;
  priceAmount?: number;
  stockQuantity?: number;
  parcel?: ParcelDimensions | null;
}

export interface ParcelDimensions {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  declaredValueMinor: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  sellerId?: string;
  seller?: { id?: string; shopName?: string } | null;
  variants?: ProductVariant[];
}

export interface ProductListResponse {
  data?: {
    content?: ProductSummary[];
    totalElements?: number;
  };
  content?: ProductSummary[];
}

export interface OrderSummary {
  id?: string;
  orderId?: string;
}

export interface OrderListResponse {
  data?: {
    content?: OrderSummary[];
  };
}

export interface OrderResponse {
  data?: {
    id?: string;
    orderId?: string;
    subOrders?: { subOrderId?: number }[];
  };
}

export interface CartResponse {
  data?: {
    items?: unknown[];
  };
}

export interface CheckoutCalculationResponse {
  data?: {
    itemsTotal?: number;
  };
}

export interface NotificationCountResponse {
  data?: { count?: number };
  count?: number;
}

export interface NotificationListResponse {
  data?: {
    content?: { id: string; read?: boolean }[];
  };
  content?: { id: string; read?: boolean }[];
}

export interface WalletResponse {
  data?: {
    balance?: number;
    availableBalance?: number;
    pendingBalance?: number;
  };
  balance?: number;
  availableBalance?: number;
  pendingBalance?: number;
}

export interface SellerSummary {
  id?: string;
  userId?: string;
  shopName?: string;
}

export interface SellerListResponse {
  data?: {
    content?: SellerSummary[];
    page?: number;
    size?: number;
    totalElements?: number;
  };
  content?: SellerSummary[];
}

export interface CouponResponse {
  id?: string;
  couponId?: string;
  data?: { id?: string };
}

export interface PayoutSummary {
  payoutId?: string;
  sellerId?: string;
  amount?: number;
  status?: string;
  completedBy?: string | null;
  completedAt?: string | null;
}

export interface PayoutListResponse {
  data?: PayoutSummary[];
}

/**
 * Playwright exposes APIResponse.json() as any. Reading text first keeps the
 * untyped boundary in this helper and makes every caller declare its payload.
 */
export async function readJson<T>(response: APIResponse): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

export async function readJsonOr<T>(response: APIResponse, fallback: T): Promise<T> {
  try {
    return await readJson<T>(response);
  } catch {
    return fallback;
  }
}
