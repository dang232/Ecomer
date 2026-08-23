import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AddToCartUseCase } from '../application/add-to-cart.use-case';
import { ClearCartUseCase } from '../application/clear-cart.use-case';
import { MergeCartUseCase } from '../application/merge-cart.use-case';
import { RemoveCartItemUseCase } from '../application/remove-cart-item.use-case';
import { UpdateCartItemUseCase } from '../application/update-cart-item.use-case';
import { ViewCartUseCase } from '../application/view-cart.use-case';
import { CartController } from './cart.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';

describe('CartController authorization', () => {
  let app: INestApplication;
  let viewCart: { execute: jest.Mock };

  beforeEach(async () => {
    const useCase = { execute: jest.fn().mockResolvedValue(null) };
    viewCart = useCase;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: AddToCartUseCase, useValue: useCase },
        { provide: ViewCartUseCase, useValue: useCase },
        { provide: UpdateCartItemUseCase, useValue: useCase },
        { provide: RemoveCartItemUseCase, useValue: useCase },
        { provide: ClearCartUseCase, useValue: useCase },
        { provide: MergeCartUseCase, useValue: useCase },
        JwtStrategy,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects caller-supplied identity without a validated principal', async () => {
    await request(app.getHttpServer())
      .get('/cart')
      .set('x-user-id', 'attacker-controlled-user')
      .expect(401);
  });

  it('uses the gateway-authenticated subject instead of x-user-id', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: AddToCartUseCase, useValue: { execute: jest.fn() } },
        { provide: ViewCartUseCase, useValue: viewCart },
        { provide: UpdateCartItemUseCase, useValue: { execute: jest.fn() } },
        { provide: RemoveCartItemUseCase, useValue: { execute: jest.fn() } },
        { provide: ClearCartUseCase, useValue: { execute: jest.fn() } },
        { provide: MergeCartUseCase, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: { authorization?: string };
              user: { sub: string };
            };
          };
        }) => {
          const requestContext = context.switchToHttp().getRequest();
          if (!requestContext.headers.authorization) return false;
          requestContext.user = { sub: 'gateway-user' };
          return true;
        },
      })
      .compile();
    const gatewayApp = moduleFixture.createNestApplication();
    await gatewayApp.init();

    await request(gatewayApp.getHttpServer())
      .get('/cart')
      .set('Authorization', 'Bearer gateway-authenticated-test-token')
      .set('x-user-id', 'attacker-controlled-user')
      .expect(200);

    expect(viewCart.execute).toHaveBeenCalledWith('gateway-user');
    await gatewayApp.close();
  });
});
