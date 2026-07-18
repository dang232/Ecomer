import { Module } from "@nestjs/common";
import { GatewayClient } from "./gateway-client.js";
import { OpenApiFetcher } from "./openapi-fetcher.js";
import { OpenApiAggregator } from "./openapi-aggregator.js";
import { DiscoveryService } from "./discovery.service.js";
import { DiscoveryController } from "./discovery.controller.js";

@Module({
  controllers: [DiscoveryController],
  providers: [
    GatewayClient,
    OpenApiFetcher,
    OpenApiAggregator,
    DiscoveryService,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
