import { MikroORM } from '@mikro-orm/core';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

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
}
