import { Controller, Post, Param, Body, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { DiscoveryService } from '../discovery/discovery.service.js';
import { PlaygroundService, PlaygroundRequest } from './playground.service.js';

@Controller('monitoring')
@Roles('ADMIN')
export class PlaygroundController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly playgroundService: PlaygroundService,
  ) {}

  @Post('endpoints/:id/test')
  async testEndpoint(
    @Param('id') id: string,
    @Body() body: Partial<PlaygroundRequest>,
    @Req() req: Request,
  ) {
    const endpoint = this.discoveryService.getEndpointById(id);
    if (!endpoint) {
      throw new NotFoundException(`Endpoint '${id}' not found`);
    }

    const authHeader = req.headers['authorization'] ?? '';
    const authToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    const playgroundReq: PlaygroundRequest = {
      method: body.method ?? endpoint.method,
      path: body.path ?? endpoint.path,
      headers: body.headers,
      body: body.body,
      queryParams: body.queryParams,
    };

    return this.playgroundService.executeRequest(playgroundReq, authToken);
  }
}
