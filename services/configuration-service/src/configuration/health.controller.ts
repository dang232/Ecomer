import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { ConfigurationService } from './configuration.service.js';

@Controller()
export class HealthController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Public()
  @Get('health')
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  getReady(): { status: 'ready' } {
    this.configurationService.assertReady();
    return { status: 'ready' };
  }
}
