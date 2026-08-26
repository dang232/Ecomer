import { MikroORM } from '@mikro-orm/core';
import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { httpServerRequestsSeconds } from './metrics';

collectDefaultMetrics({ prefix: 'vnshop_' });
void httpServerRequestsSeconds;

@Controller()
export class AppController {
  constructor(private readonly orm: MikroORM) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: string }> {
    if (!(await this.orm.isConnected())) {
      throw new ServiceUnavailableException('database unavailable');
    }
    return { status: 'ready' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
