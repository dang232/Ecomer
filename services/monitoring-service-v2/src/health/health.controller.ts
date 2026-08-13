import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { HealthService } from './health.service.js';
import { MetricsService } from '../metrics/metrics.service.js';
import { DiscoveryService } from '../discovery/discovery.service.js';

@Controller('monitoring')
@Roles('ADMIN')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  @Get('services')
  getServices() {
    return this.healthService.getAllStatuses();
  }

  @Get('services/:id/history')
  async getHistory(
    @Param('id') id: string,
    @Query('period') period: '1h' | '24h' | '7d' = '24h',
  ) {
    const svc = this.discoveryService.getServiceById(id);
    if (!svc) throw new NotFoundException('Service not found');
    return this.metricsService.getHistory(id, period);
  }

  @Get('services/:id/dependencies')
  getDependencies(@Param('id') id: string) {
    const status = this.healthService.getStatus(id);
    if (!status) throw new NotFoundException('Service not found');
    return { serviceId: id, dependencies: status.dependencies };
  }

  @Get('alerts')
  getAlerts() {
    return this.metricsService.getActiveAlerts();
  }

  @Get('alerts/history')
  getAlertHistory() {
    return this.metricsService.getAlertHistory(7);
  }
}
