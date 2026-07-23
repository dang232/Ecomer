import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CartResponse } from '../src/cart/application/cart.response';
import { REDIS_CLIENT } from '../src/cart/cart.module';
import { ApiResponse } from '../src/cart/infrastructure/api-response';

class InMemoryRedis {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  setex(key: string, _ttlSeconds: number, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }

  disconnect(): void {}
}

interface SupertestBody<T> {
  body: T;
}

describe('CartController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue(new InMemoryRedis())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('drives cart HTTP surface', async () => {
    await request(app.getHttpServer())
      .get('/cart')
      .set('x-user-id', 'user-1')
      .expect(200)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.success).toBe(true);
        expect(body.data?.itemCount).toBe(0);
      });

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('x-user-id', 'user-1')
      .send({ productId: 'product-1', quantity: 2 })
      .expect(201)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.success).toBe(true);
        expect(body.message).toBe('Cart item added');
        expect(body.data?.itemCount).toBe(2);
        expect(body.data?.items[0]?.productId).toBe('product-1');
      });

    await request(app.getHttpServer())
      .put('/cart/items/product-1')
      .set('x-user-id', 'user-1')
      .send({ quantity: 3 })
      .expect(200)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.success).toBe(true);
        expect(body.data?.itemCount).toBe(3);
      });

    await request(app.getHttpServer())
      .delete('/cart/items/product-1')
      .set('x-user-id', 'user-1')
      .expect(200)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.success).toBe(true);
        expect(body.data?.itemCount).toBe(0);
      });

    const mergeRequest = {
      sessionId: 'guest-session-1',
      idempotencyKey: 'merge-attempt-1',
      items: [{ productId: 'product-2', quantity: 2 }],
    };
    await request(app.getHttpServer())
      .post('/cart/merge')
      .set('x-user-id', 'user-1')
      .send(mergeRequest)
      .expect(201)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.data?.itemCount).toBe(2);
      });

    await request(app.getHttpServer())
      .post('/cart/merge')
      .set('x-user-id', 'user-1')
      .send(mergeRequest)
      .expect(201)
      .expect(({ body }: SupertestBody<ApiResponse<CartResponse>>) => {
        expect(body.data?.itemCount).toBe(2);
      });
  });

  it('returns ApiResponse error for missing user header', async () => {
    await request(app.getHttpServer())
      .get('/cart')
      .expect(400)
      .expect(({ body }: SupertestBody<ApiResponse<null>>) => {
        expect(body.success).toBe(false);
        expect(body.errorCode).toBe('BAD_REQUEST');
        expect(body.data).toBeNull();
      });
  });
});
