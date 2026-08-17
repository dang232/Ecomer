import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const BUYER_ID = __ENV.BUYER_ID || 'k6-buyer';
const DEFAULT_PRODUCT_ID = __ENV.PRODUCT_ID || 'phase-1-product';
const DEFAULT_VARIANT_SKU = __ENV.VARIANT_SKU || 'STANDARD';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{flow:checkout}': ['p(95)<2000'],
  },
};

function ok(response, name) {
  return check(response, {
    [`${name} returns 2xx/3xx`]: (res) => res.status >= 200 && res.status < 400,
  });
}

function parseJson(response, fallback) {
  try {
    return response.json();
  } catch (_error) {
    return fallback;
  }
}

function firstProduct(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { id: DEFAULT_PRODUCT_ID, variants: [{ sku: DEFAULT_VARIANT_SKU }] };
  }

  return randomItem(products);
}

function variantSku(product) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants[0].sku || DEFAULT_VARIANT_SKU;
  }

  return DEFAULT_VARIANT_SKU;
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'X-Buyer-Id': `${BUYER_ID}-${__VU}`,
  };

  group('browse products', () => {
    const productsResponse = http.get(`${BASE_URL}/products`, { tags: { flow: 'browse' } });
    ok(productsResponse, 'GET /products');

    const product = firstProduct(parseJson(productsResponse, []));
    const productId = product.id || DEFAULT_PRODUCT_ID;
    const sku = variantSku(product);

    const detailResponse = http.get(`${BASE_URL}/products/${encodeURIComponent(productId)}`, { tags: { flow: 'view-product' } });
    ok(detailResponse, 'GET /products/{id}');

    const addCartResponse = http.post(
      `${BASE_URL}/cart/items`,
      JSON.stringify({ productId, variantSku: sku, name: 'k6 load item', quantity: 1, unitPrice: 100000 }),
      { headers, tags: { flow: 'cart' } }
    );
    ok(addCartResponse, 'POST /cart/items');

    const checkoutResponse = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        shippingAddress: { street: '1 Load Test', ward: 'Ward 1', district: 'District 1', city: 'Ho Chi Minh City' },
        shippingDetails: {
          recipientName: 'k6 Load Buyer',
          recipientPhone: '+84900000001',
          wardCode: 'WARD-1',
          districtCode: 'DISTRICT-1',
          provinceCode: 'HCM',
          weightGrams: 1000,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 10,
        },
        items: [{ productId, variantSku: sku, name: 'k6 load item', quantity: 1, unitPrice: 100000 }],
      }),
      {
        headers: { ...headers, 'Idempotency-Key': `k6-${__VU}-${__ITER}` },
        tags: { flow: 'checkout' },
      }
    );
    ok(checkoutResponse, 'POST /orders checkout');
  });

  sleep(1);
}
