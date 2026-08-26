import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/core';
import { PassportModule } from '@nestjs/passport';
import Redis from 'ioredis';
import { AddToCartUseCase } from './application/add-to-cart.use-case';
import { ClearCartUseCase } from './application/clear-cart.use-case';
import { MergeCartUseCase } from './application/merge-cart.use-case';
import type { ProductClientPort } from './application/product-client.port';
import { PRODUCT_CLIENT } from './application/product-client.token';
import { RemoveCartItemUseCase } from './application/remove-cart-item.use-case';
import { UpdateCartItemUseCase } from './application/update-cart-item.use-case';
import { ViewCartUseCase } from './application/view-cart.use-case';
import type { CartRepository } from './domain/cart.repository';
import { CART_REPOSITORY } from './domain/cart-repository.token';
import { CartController } from './infrastructure/cart.controller';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { CartMikroOrmEntity } from './infrastructure/cart.mikro-orm-entity.js';
import { CartPersistenceService } from './infrastructure/cart-persistence.service';
import { ProductHttpClientAdapter } from './infrastructure/product-http-client.adapter';
import { REDIS_CLIENT } from './redis-client.token';

export { REDIS_CLIENT } from './redis-client.token';

@Module({
  imports: [
    MikroOrmModule.forFeature([CartMikroOrmEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [CartController],
  providers: [
    JwtStrategy,
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        const sentinelNodes = configService
          .get<string>('REDIS_SENTINEL_NODES')
          ?.split(',')
          .map((node) => node.trim())
          .filter(Boolean);
        const password = configService.get<string>('REDIS_PASSWORD') || undefined;
        const commonOptions = {
          password,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        };

        if (sentinelNodes?.length) {
          return new Redis({
            ...commonOptions,
            sentinels: sentinelNodes.map((node) => {
              const [host, port = '26379'] = node.split(':');
              return { host, port: Number(port) };
            }),
            name: configService.get<string>('REDIS_SENTINEL_MASTER') ?? 'redis-cart',
          });
        }

        return new Redis({
          ...commonOptions,
          host: configService.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
          db: Number(configService.get<string>('REDIS_DB') ?? 0),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: CART_REPOSITORY,
      useFactory: (em: EntityManager, redis: Redis): CartRepository =>
        new CartPersistenceService(em, redis),
      inject: [EntityManager, REDIS_CLIENT],
    },
    {
      provide: PRODUCT_CLIENT,
      useFactory: (configService: ConfigService): ProductClientPort =>
        new ProductHttpClientAdapter(
          configService.get<string>('PRODUCT_SERVICE_URL'),
          configService.get<string>('USER_SERVICE_URL') ??
            'http://user-service:8081',
          Number(
            configService.get<string>('USER_SERVICE_TIMEOUT_MS') ?? '2000',
          ),
        ),
      inject: [ConfigService],
    },
    {
      provide: AddToCartUseCase,
      useFactory: (
        repository: CartRepository,
        productClient: ProductClientPort,
      ): AddToCartUseCase => new AddToCartUseCase(repository, productClient),
      inject: [CART_REPOSITORY, PRODUCT_CLIENT],
    },
    {
      provide: ViewCartUseCase,
      useFactory: (
        repository: CartRepository,
        productClient: ProductClientPort,
      ): ViewCartUseCase => new ViewCartUseCase(repository, productClient),
      inject: [CART_REPOSITORY, PRODUCT_CLIENT],
    },
    {
      provide: UpdateCartItemUseCase,
      useFactory: (repository: CartRepository): UpdateCartItemUseCase =>
        new UpdateCartItemUseCase(repository),
      inject: [CART_REPOSITORY],
    },
    {
      provide: RemoveCartItemUseCase,
      useFactory: (repository: CartRepository): RemoveCartItemUseCase =>
        new RemoveCartItemUseCase(repository),
      inject: [CART_REPOSITORY],
    },
    {
      provide: ClearCartUseCase,
      useFactory: (repository: CartRepository): ClearCartUseCase =>
        new ClearCartUseCase(repository),
      inject: [CART_REPOSITORY],
    },
    {
      provide: MergeCartUseCase,
      useFactory: (
        repository: CartRepository,
        productClient: ProductClientPort,
      ): MergeCartUseCase => new MergeCartUseCase(repository, productClient),
      inject: [CART_REPOSITORY, PRODUCT_CLIENT],
    },
  ],
})
export class CartModule {}
