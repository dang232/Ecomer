import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator.js';

@Controller()
export class ProbeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  @Public()
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<{ status: string }> {
    if (!this.dataSource.isInitialized) {
      throw new ServiceUnavailableException('timescaledb unavailable');
    }
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('timescaledb unavailable');
    }
    return { status: 'ready' };
  }
}
