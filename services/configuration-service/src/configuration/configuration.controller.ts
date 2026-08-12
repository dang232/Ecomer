import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service.js';
import { AppConfigDto } from './dto/app-config.dto.js';
import { PublicConfigDto } from './dto/public-config.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('api')
export class ConfigurationController {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Public()
  @Get('config')
  getConfig(): AppConfigDto {
    return this.configurationService.getConfig();
  }

  @Public()
  @Get('config/public')
  getPublicConfig(): PublicConfigDto {
    return this.configurationService.getPublicConfig();
  }

  @Roles('ADMIN')
  @Get('config/services')
  @ApiExcludeEndpoint()
  getAllServiceConfigs(): Record<string, Record<string, unknown>> {
    return this.configurationService.getAllServiceConfigs();
  }

  @Roles('ADMIN')
  @Get('config/services/:serviceName')
  @ApiExcludeEndpoint()
  getServiceConfig(@Param('serviceName') serviceName: string): Record<string, unknown> {
    return this.configurationService.getServiceConfig(serviceName);
  }

  @Roles('ADMIN')
  @Get('config/global')
  @ApiExcludeEndpoint()
  getGlobalConfig(): Record<string, unknown> {
    return this.configurationService.getGlobalConfig();
  }

  @Roles('ADMIN')
  @Post('config/reload')
  @ApiExcludeEndpoint()
  reloadConfigs(): { status: string } {
    this.configurationService.reloadConfigs();
    return { status: 'reloaded' };
  }
}
