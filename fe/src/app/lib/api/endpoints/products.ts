import {
  pageSchema,
  productDetailSchema,
  productImageActivateSchema,
  productImageUploadUrlSchema,
  productSummarySchema,
  cursorPageSchema,
} from "../../../types/api";
import { api } from "../client";

export interface ProductListParams {
  page?: number;
  size?: number;
  categoryId?: string;
  q?: string;
  sort?: string;
  sellerId?: string;
}

/** @deprecated Use productListV2 for buyer catalog reads. */
export const productList = (params: ProductListParams = {}) =>
  api.get(
    "/products",
    pageSchema(productSummarySchema),
    {
      page: params.page,
      size: params.size ?? 24,
      categoryId: params.categoryId,
      q: params.q,
      sort: params.sort,
      sellerId: params.sellerId,
    },
    { auth: false },
  );

export interface ProductListV2Params {
  cursor?: string;
  limit?: number;
  category?: string;
  brand?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
  includeFacets?: boolean;
}

const productListV2Schema = cursorPageSchema(productSummarySchema);

/** Default cursor catalog read. */
export const productListV2 = (params: ProductListV2Params = {}, signal?: AbortSignal) =>
  api.getWithMeta(
    "/products/v2",
    productListV2Schema,
    {
      q: params.q,
      category: params.category,
      brand: params.brand,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
      sameDay: params.sameDay,
      verifiedOnly: params.verifiedOnly,
      officialOnly: params.officialOnly,
      cursor: params.cursor,
      limit: params.limit ?? 24,
      includeFacets: params.includeFacets,
    },
    { auth: false, signal },
  );

export const productById = (id: string) =>
  api.get(`/products/${encodeURIComponent(id)}`, productDetailSchema, undefined, { auth: false });

/** Body for create / update on the seller product endpoints. */
export interface SellerVariant {
  sku: string;
  name: string;
  priceAmount: number;
  priceCurrency?: string;
  imageUrl?: string;
  stockQuantity: number;
}

export interface SellerImage {
  url: string;
  alt?: string;
  sortOrder?: number;
}

export interface SellerProductWriteBody {
  name: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  tags?: string[];
  variants?: SellerVariant[];
  images?: SellerImage[];
}

export const sellerProductCreate = (body: SellerProductWriteBody) =>
  api.post("/sellers/me/products", productDetailSchema, body);

export const sellerProductUpdate = (id: string, body: SellerProductWriteBody) =>
  api.put(`/sellers/me/products/${encodeURIComponent(id)}`, productDetailSchema, body);

export const sellerProductPublish = (id: string) =>
  api.put(`/sellers/me/products/${encodeURIComponent(id)}/publish`, productDetailSchema);

export const sellerProductImageUploadUrl = (
  productId: string,
  body: {
    fileName: string;
    declaredContentType: string;
    detectedContentType: string;
    contentLength: number;
    sha256Hex: string;
    imageWidth: number;
    imageHeight: number;
  },
) =>
  api.post(
    `/sellers/me/products/${encodeURIComponent(productId)}/images/upload-url`,
    productImageUploadUrlSchema,
    body,
  );

export const sellerProductImageActivate = (
  productId: string,
  body: {
    objectKey: string;
    detectedContentType: string;
    contentLength: number;
    sha256Hex: string;
    imageWidth: number;
    imageHeight: number;
  },
) =>
  api.post(
    `/sellers/me/products/${encodeURIComponent(productId)}/images/activate`,
    productImageActivateSchema,
    body,
  );
