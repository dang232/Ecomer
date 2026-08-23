import type { APIRequestContext } from "@playwright/test";

import { readJson, type AuthResponse, type ParcelDimensions, type ProductSummary } from "./_api";
import { uniqueTestId } from "./_auth";
import { credentialForPersona } from "./modernization/_credentials";

const apiURL = process.env.VITE_E2E_API_URL ?? "http://localhost:8080";

const TRUSTED_PARCEL: ParcelDimensions = {
  weightGrams: 1000,
  lengthCm: 30,
  widthCm: 20,
  heightCm: 10,
};

export interface TrustedSellerProduct {
  id: string;
  name: string;
  sku: string;
  sellerId: string;
}

interface ProductResponse {
  data?: ProductSummary;
}

function productFromResponse(payload: ProductResponse, operation: string): TrustedSellerProduct {
  const product = payload.data;
  const variant = product?.variants?.[0];
  const parcel = variant?.parcel;
  if (
    !product?.id ||
    !product?.name ||
    !product?.sellerId ||
    !variant?.sku ||
    parcel?.weightGrams !== TRUSTED_PARCEL.weightGrams ||
    parcel?.lengthCm !== TRUSTED_PARCEL.lengthCm ||
    parcel?.widthCm !== TRUSTED_PARCEL.widthCm ||
    parcel?.heightCm !== TRUSTED_PARCEL.heightCm
  ) {
    throw new Error(`${operation} response did not contain the expected trusted parcel product`);
  }
  return { id: product.id, name: product.name, sku: variant.sku, sellerId: product.sellerId };
}

async function sellerAccessToken(request: APIRequestContext): Promise<string> {
  const credentials = credentialForPersona("seller");
  const response = await request.post(`${apiURL}/auth/login`, {
    data: { username: credentials.username, password: credentials.password },
  });
  if (!response.ok()) {
    throw new Error(`seller login failed: HTTP ${response.status()} ${await response.text()}`);
  }
  const token = (await readJson<AuthResponse>(response)).data?.accessToken;
  if (!token) throw new Error("seller login response did not include an access token");
  return token;
}

export async function createTrustedSellerProduct(
  request: APIRequestContext,
): Promise<TrustedSellerProduct> {
  const accessToken = await sellerAccessToken(request);
  const id = uniqueTestId();
  const name = `E2E trusted parcel product ${id}`;
  const sku = `E2E-TRUSTED-${id}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const body = {
    name,
    description: "E2E product with trusted parcel metadata",
    categoryId: "electronics",
    brand: "E2E",
    variants: [
      {
        sku,
        name: "Default",
        priceAmount: 199000,
        priceCurrency: "VND",
        stockQuantity: 50,
        parcel: TRUSTED_PARCEL,
      },
    ],
    images: [],
    tags: [],
  };
  const created = await request.post(`${apiURL}/sellers/me/products`, { headers, data: body });
  if (!created.ok()) {
    throw new Error(
      `trusted product creation failed: HTTP ${created.status()} ${await created.text()}`,
    );
  }
  const createdProduct = productFromResponse(await readJson<ProductResponse>(created), "create");
  const published = await request.put(
    `${apiURL}/sellers/me/products/${encodeURIComponent(createdProduct.id)}/publish`,
    { headers },
  );
  if (!published.ok()) {
    throw new Error(
      `trusted product publish failed: HTTP ${published.status()} ${await published.text()}`,
    );
  }
  return productFromResponse(await readJson<ProductResponse>(published), "publish");
}

export async function clearBuyerCart(
  request: APIRequestContext,
  accessToken: string,
): Promise<void> {
  const response = await request.delete(`${apiURL}/cart`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok()) {
    throw new Error(`buyer cart clear failed: HTTP ${response.status()} ${await response.text()}`);
  }
}

export async function addProductToCart(
  request: APIRequestContext,
  accessToken: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const response = await request.post(`${apiURL}/cart/items`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { productId, quantity },
  });
  if (!response.ok()) {
    throw new Error(`product cart add failed: HTTP ${response.status()} ${await response.text()}`);
  }
}
