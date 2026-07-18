import {
  Controller,
  Get,
  Param,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator.js";
import { DiscoveryService } from "./discovery.service.js";

@Controller("monitoring")
@Roles("admin")
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get("endpoints")
  getEndpoints() {
    const endpoints = this.discoveryService.getEndpoints();
    const services = this.discoveryService.getServices();

    const grouped = services.map((svc) => ({
      service: svc,
      endpoints: endpoints.filter((e) => e.serviceId === svc.id),
    }));

    return grouped;
  }

  @Get("endpoints/:id/schema")
  getEndpointSchema(@Param("id") id: string) {
    const endpoint = this.discoveryService.getEndpointById(id);
    if (!endpoint) throw new NotFoundException("Endpoint not found");
    return endpoint;
  }

  @Get("openapi.json")
  getOpenApiDocument() {
    const document = this.discoveryService.getOpenApiDocument();
    if (!document) {
      throw new ServiceUnavailableException(
        "OpenAPI document is not available",
      );
    }
    return document;
  }
}
