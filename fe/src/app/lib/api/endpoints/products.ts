import {
  pageSchema,
  productDetailSchema,
  productImageActivateSchema,
  productImageUploadUrlSchema,
  productSummarySchema,
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
  body: { contentType: string; size?: number },
) =>
  api.post(
    `/sellers/me/products/${encodeURIComponent(productId)}/images/upload-url`,
    productImageUploadUrlSchema,
    body,
  );

export const sellerProductImageActivate = (productId: string, body: { key: string }) =>
  api.post(
    `/sellers/me/products/${encodeURIComponent(productId)}/images/activate`,
    productImageActivateSchema,
    body,
  );
