import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const sentinelNodes = config
          .get<string>('REDIS_SENTINEL_NODES')
          ?.split(',')
          .map((node) => node.trim())
          .filter(Boolean);
        const password = config.get<string>('REDIS_PASSWORD') || undefined;

        if (sentinelNodes?.length) {
          return new Redis({
            sentinels: sentinelNodes.map((node) => {
              const [host, port = '26379'] = node.split(':');
              return { host, port: Number(port) };
            }),
            name: config.get<string>('REDIS_SENTINEL_MASTER') ?? 'redis-dedup',
            password,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
          });
        }

        if (!url) {
          throw new Error(
            'REDIS_URL or REDIS_SENTINEL_NODES environment variable is required',
          );
        }
        return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onApplicationShutdown() {
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }
}
