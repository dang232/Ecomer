import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { STATES, type Connection } from 'mongoose';
import { REDIS_CLIENT } from './notification/infrastructure/cache/redis.module';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string }> {
    if (this.mongo.readyState !== STATES.connected) {
      throw new ServiceUnavailableException('mongodb unavailable');
    }
    try {
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException('redis unavailable');
    }
    return { status: 'ready' };
  }
}
