import { z } from "zod";

import { api } from "@/shared/api/client";
import {
  pageSchema,
  productDetailSchema,
  productImageActivateSchema,
  productImageUploadUrlSchema,
  productSummarySchema,
  cursorPageSchema,
  emptyResponseSchema,
} from "@/shared/contracts/api";

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

export const productListV2ParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  q: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  sort: z.string().optional(),
  sameDay: z.boolean().optional(),
  verifiedOnly: z.boolean().optional(),
  officialOnly: z.boolean().optional(),
  includeFacets: z.boolean().optional(),
});
export type ProductListV2Params = z.infer<typeof productListV2ParamsSchema>;

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

export interface SellerProductListParams {
  page?: number;
  size?: number;
  categoryId?: string;
  q?: string;
  status?: string;
}

/** Authenticated seller-management page. The server scopes ownership from the JWT. */
export const sellerProductList = (params: SellerProductListParams = {}) =>
  api.get(
    "/sellers/me/products",
    pageSchema(productSummarySchema),
    {
      page: params.page,
      size: params.size ?? 24,
      categoryId: params.categoryId,
      q: params.q,
      status: params.status,
    },
    { auth: true },
  );

/** Authenticated seller-management detail. The server scopes ownership from the JWT. */
export const sellerProductById = (id: string) =>
  api.get(`/sellers/me/products/${encodeURIComponent(id)}`, productDetailSchema, undefined, {
    auth: true,
  });

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

/** DELETE /sellers/me/products/{id} — waits for 204. */
export const sellerProductDelete = (id: string) =>
  api.delete(`/sellers/me/products/${encodeURIComponent(id)}`, emptyResponseSchema);

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
