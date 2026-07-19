import { Module } from '@nestjs/common';
import { ConfigurationController } from './configuration.controller.js';
import { ConfigurationService } from './configuration.service.js';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [ConfigurationController, HealthController],
  providers: [ConfigurationService],
})
export class ConfigurationModule {}
