import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from '../config.js';

export const options = {
  scenarios: {
    checkout_steady: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
  thresholds,
};

export default function () {
  const idempotencyKey = `idk-${__VU}-${__ITER}-${Date.now()}`;

  group('checkout flow', () => {
    const calcRes = http.post(
      `${BASE_URL}/checkout/calculate`,
      JSON.stringify({ cartId: 'test-cart-1', shippingMethod: 'STANDARD' }),
      { headers: defaultHeaders }
    );
    check(calcRes, { 'calculate 200': (r) => r.status === 200 });

    const orderRes = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        cartId: 'test-cart-1',
        paymentMethod: 'COD',
        shippingAddress: { street: '123 Test', city: 'HCMC', district: '1' },
        shippingDetails: {
          recipientName: 'k6 Checkout Buyer',
          recipientPhone: '+84900000003',
          wardCode: 'WARD-1',
          districtCode: 'DISTRICT-1',
          provinceCode: 'HCM',
          weightGrams: 1000,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 10,
        }
      }),
      { headers: { ...defaultHeaders, 'Idempotency-Key': idempotencyKey } }
    );
    check(orderRes, { 'order created': (r) => [200, 201].includes(r.status) });
  });

  sleep(1);
}
