import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const PRODUCT_ID = __ENV.PRODUCT_ID || 'phase-1-product';
const VARIANT_SKU = __ENV.VARIANT_SKU || 'STANDARD';
const RATE_LIMIT_MIN_THROTTLE_RATE = Number(__ENV.RATE_LIMIT_MIN_THROTTLE_RATE || '0.01');
const redisRateLimited = new Rate('redis_rate_limited');

export const options = {
  stages: [
    { duration: '10s', target: 500 },
    { duration: '30s', target: 500 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    'checks{gate:redis-rate-limit}': ['rate>0.90'],
    redis_rate_limited: [`rate>${RATE_LIMIT_MIN_THROTTLE_RATE}`],
    'http_reqs{flow:flash-sale}': ['rate>100'],
  },
};

function acceptedOrRateLimited(response) {
  return response.status >= 200 && response.status < 400 || response.status === 429;
}

export default function () {
  const buyerId = `flash-${__VU}-${__ITER}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Buyer-Id': buyerId,
    'Idempotency-Key': `flash-${__VU}-${__ITER}`,
  };

  group('flash sale rate gate', () => {
    const browseResponse = http.get(`${BASE_URL}/products/${encodeURIComponent(PRODUCT_ID)}`, {
      tags: { flow: 'flash-sale', gate: 'redis-rate-limit' },
    });

    check(browseResponse, {
      'product route accepts or Redis rate gate throttles': acceptedOrRateLimited,
    }, { gate: 'redis-rate-limit' });

    const orderResponse = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        shippingAddress: { street: '500 Flash Sale', ward: 'Ward 5', district: 'District 5', city: 'Ho Chi Minh City' },
        shippingDetails: {
          recipientName: 'Flash Sale Buyer',
          recipientPhone: '+84900000002',
          wardCode: 'WARD-5',
          districtCode: 'DISTRICT-5',
          provinceCode: 'HCM',
          weightGrams: 1000,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 10,
        },
        items: [{ productId: PRODUCT_ID, variantSku: VARIANT_SKU, name: 'flash sale item', quantity: 1, unitPrice: 100000 }],
      }),
      { headers, tags: { flow: 'flash-sale', gate: 'redis-rate-limit' } }
    );

    redisRateLimited.add(orderResponse.status === 429);

    check(orderResponse, {
      'checkout accepts or Redis rate gate throttles': acceptedOrRateLimited,
      'Redis Lua rate gate returns 429 during spike': (res) => res.status === 429 || __ITER === 0,
    }, { gate: 'redis-rate-limit' });
  });

  sleep(0.1);
}
