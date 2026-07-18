import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import axios from "axios";
import { GatewayClient } from "./gateway-client.js";
import { OpenApiFetcher } from "./openapi-fetcher.js";
import { OpenApiAggregator } from "./openapi-aggregator.js";
import { DEPRECATED_SERVICES } from "./deprecated-services.js";
import {
  DiscoveredService,
  DiscoveredEndpoint,
  FetchedOpenApiSpec,
  OpenApiDocument,
  OpenApiServiceStatus,
} from "./discovery.types.js";

/**
 * Static service registry used as fallback when the gateway actuator is
 * unreachable (e.g. requires auth). Maps Docker service hostnames to ports.
 */
const STATIC_SERVICES: DiscoveredService[] = [
  {
    id: "user-service",
    name: "User Service",
    url: "http://user-service:8081",
    healthPath: "/actuator/health",
    routes: ["/users/**", "/sellers/**", "/auth/**", "/admin/**"],
  },
  {
    id: "product-service",
    name: "Product Service",
    url: "http://product-service:8082",
    healthPath: "/actuator/health",
    routes: [
      "/products/**",
      "/videos/**",
      "/categories/**",
      "/questions/**",
      "/sellers/me/products/**",
      "/reviews/**",
      "/admin/reviews/**",
      "/admin/videos/**",
    ],
  },
  {
    id: "inventory-service",
    name: "Inventory Service",
    url: "http://inventory-service:8083",
    healthPath: "/actuator/health",
    routes: ["/flash-sale/**"],
  },
  {
    id: "cart-service",
    name: "Cart Service",
    url: "http://cart-service:8084",
    healthPath: "/health",
    routes: ["/cart/**"],
  },
  {
    id: "search-service",
    name: "Search Service",
    url: "http://search-service:8086",
    healthPath: "/actuator/health",
    routes: ["/search/**"],
  },
  {
    id: "notification-service",
    name: "Notification Service",
    url: "http://notification-service:8087",
    healthPath: "/health",
    routes: ["/notifications/**"],
  },
  {
    id: "coupon-service",
    name: "Coupon Service",
    url: "http://coupon-service:8088",
    healthPath: "/actuator/health",
    routes: ["/checkout/**", "/coupons/**", "/admin/coupons/**"],
  },
  {
    id: "seller-finance-service",
    name: "Seller Finance Service",
    url: "http://seller-finance-service:8090",
    healthPath: "/actuator/health",
    routes: [
      "/sellers/me/finance/**",
      "/seller-finance/**",
      "/admin/finance/**",
    ],
  },
  {
    id: "order-service",
    name: "Order Service",
    url: "http://order-service:8091",
    healthPath: "/actuator/health",
    routes: [
      "/seller/orders/**",
      "/checkout/**",
      "/returns/**",
      "/invoices/**",
      "/orders/**",
      "/sellers/me/revenue",
      "/sellers/me/analytics/**",
      "/admin/**",
    ],
  },
  {
    id: "payment-service",
    name: "Payment Service",
    url: "http://payment-service:8092",
    healthPath: "/actuator/health",
    routes: ["/payment/**", "/admin/vietqr/**"],
  },
  {
    id: "shipping-service",
    name: "Shipping Service",
    url: "http://shipping-service:8093",
    healthPath: "/actuator/health",
    routes: ["/shipping/**"],
  },
  {
    id: "recommendations-service",
    name: "Recommendations Service",
    url: "http://recommendations-service:8094",
    healthPath: "/actuator/health",
    routes: ["/recommendations/**"],
  },
  {
    id: "messaging-service",
    name: "Messaging Service",
    url: "http://messaging-service:8095",
    healthPath: "/health",
    routes: ["/messaging/**"],
  },
  {
    id: "configuration-service",
    name: "Configuration Service",
    url: "http://configuration-service:8097",
    healthPath: "/actuator/health",
    routes: ["/api/config"],
  },
];

const REFRESH_INTERVAL_MS = Number.parseInt(
  process.env.OPENAPI_REFRESH_INTERVAL_MS ??
    process.env.DISCOVERY_INTERVAL_MS ??
    "300000",
  10,
);

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryService.name);
  private services: DiscoveredService[] = [];
  private endpoints: DiscoveredEndpoint[] = [];
  private openApiDocument?: OpenApiDocument;
  private openApiStatuses: OpenApiServiceStatus[] = [];
  private readonly cachedSpecs = new Map<string, FetchedOpenApiSpec>();
  private readonly useStaticRegistry: boolean;
  private readonly openApiEnabled: boolean;

  constructor(
    private readonly gatewayClient: GatewayClient,
    private readonly openApiFetcher: OpenApiFetcher,
    private readonly openApiAggregator: OpenApiAggregator,
    private readonly config: ConfigService,
  ) {
    this.useStaticRegistry =
      this.config.get<string>("app.discoveryMode", "auto") === "static";
    this.openApiEnabled =
      this.config.get<string>("app.openapiEnabled", "true") !== "false";
  }

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  @Interval(REFRESH_INTERVAL_MS)
  async refresh(): Promise<void> {
    this.logger.log("Refreshing service discovery...");

    if (this.useStaticRegistry) {
      this.services = [...STATIC_SERVICES];
      this.logger.log(
        `Using static registry: ${this.services.length} services`,
      );
      await this.refreshEndpoints();
      return;
    }

    const routes = await this.gatewayClient.fetchRoutes();

    if (routes.length > 0) {
      this.services = this.gatewayClient.parseServices(routes);
      await this.detectHealthPaths();
      await this.refreshEndpoints();
      this.logger.log(
        `Discovered ${this.services.length} services, ${this.endpoints.length} endpoints`,
      );
    } else if (this.services.length === 0) {
      this.logger.warn(
        "Gateway discovery failed — falling back to static registry",
      );
      this.services = [...STATIC_SERVICES];
      await this.refreshEndpoints();
      this.logger.log(`Static fallback: ${this.services.length} services`);
    }
  }

  private async detectHealthPaths(): Promise<void> {
    for (const svc of this.services) {
      try {
        await axios.get(`${svc.url}/actuator/health`, { timeout: 2000 });
        svc.healthPath = "/actuator/health";
      } catch {
        svc.healthPath = "/health";
      }
    }
  }

  private async refreshEndpoints(): Promise<void> {
    const fetched = await Promise.all(
      this.services.map((svc) =>
        this.openApiFetcher.fetchOpenApi(svc.url, svc.id),
      ),
    );

    const byService = new Map(
      fetched.map((result) => [result.serviceId, result]),
    );
    const allEndpoints: DiscoveredEndpoint[] = [];
    const statuses: OpenApiServiceStatus[] = [];

    for (const service of this.services) {
      const result = byService.get(service.id);
      if (!result) continue;

      if (result.status === "healthy" && result.spec) {
        this.cachedSpecs.set(service.id, result);
        allEndpoints.push(...result.endpoints);
        statuses.push(result);
        continue;
      }

      const cached = this.cachedSpecs.get(service.id);
      if (cached) {
        allEndpoints.push(...cached.endpoints);
        statuses.push({
          ...result,
          status: "stale",
          sourcePath: cached.sourcePath,
          pathCount: cached.pathCount,
          lastFetchedAt: cached.lastFetchedAt,
        });
      } else {
        statuses.push(result);
      }
    }

    this.endpoints = allEndpoints;
    this.openApiStatuses = statuses;

    if (!this.openApiEnabled) return;

    const currentSpecs = this.services
      .map((service) => this.cachedSpecs.get(service.id))
      .filter((spec): spec is FetchedOpenApiSpec => !!spec);

    if (currentSpecs.length === 0) return;

    try {
      this.openApiDocument = this.openApiAggregator.merge(
        currentSpecs,
        statuses,
        DEPRECATED_SERVICES,
        new Map(this.services.map((service) => [service.id, service])),
      );
    } catch (error) {
      this.logger.error(
        `OpenAPI aggregation failed: ${(error as Error).message}`,
      );
      if (this.openApiDocument) {
        this.openApiDocument = this.openApiAggregator.withStatuses(
          this.openApiDocument,
          statuses.map((status) => ({
            ...status,
            status: status.status === "healthy" ? "stale" : status.status,
          })),
        );
      }
    }
  }

  getServices(): DiscoveredService[] {
    return this.services;
  }

  getEndpoints(): DiscoveredEndpoint[] {
    return this.endpoints;
  }

  getEndpointById(id: string): DiscoveredEndpoint | undefined {
    return this.endpoints.find((e) => e.id === id);
  }

  getServiceById(id: string): DiscoveredService | undefined {
    return this.services.find((s) => s.id === id);
  }

  getOpenApiDocument(): OpenApiDocument | undefined {
    return this.openApiDocument;
  }

  getOpenApiStatuses(): OpenApiServiceStatus[] {
    return this.openApiStatuses;
  }
}
