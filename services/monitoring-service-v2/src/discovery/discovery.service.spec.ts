import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DiscoveryService } from "./discovery.service.js";
import { GatewayClient } from "./gateway-client.js";
import { OpenApiFetcher } from "./openapi-fetcher.js";
import { OpenApiAggregator } from "./openapi-aggregator.js";

jest.mock("axios");

describe("DiscoveryService", () => {
  let service: DiscoveryService;
  const mockGatewayClient = {
    fetchRoutes: jest.fn(),
    parseServices: jest.fn(),
  };
  const mockOpenApiFetcher = { fetchOpenApi: jest.fn() };
  const mockOpenApiAggregator = { merge: jest.fn(), withStatuses: jest.fn() };
  const mockConfig = { get: jest.fn().mockReturnValue(300000) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: GatewayClient, useValue: mockGatewayClient },
        { provide: OpenApiFetcher, useValue: mockOpenApiFetcher },
        { provide: OpenApiAggregator, useValue: mockOpenApiAggregator },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(DiscoveryService);
    jest.clearAllMocks();
  });

  it("populates services on refresh", async () => {
    const routes = [
      {
        route_id: "cart",
        uri: "http://cart-service:8084",
        predicates: [],
        filters: [],
        order: 0,
      },
    ];
    const services = [
      {
        id: "cart-service",
        name: "Cart Service",
        url: "http://cart-service:8084",
        healthPath: "/health",
        routes: ["/cart/**"],
      },
    ];

    mockGatewayClient.fetchRoutes.mockResolvedValue(routes);
    mockGatewayClient.parseServices.mockReturnValue(services);
    mockOpenApiFetcher.fetchOpenApi.mockResolvedValue({
      serviceId: "cart-service",
      sourcePath: "",
      status: "missing",
      pathCount: 0,
      endpoints: [],
    });

    await service.refresh();

    expect(service.getServices()).toHaveLength(1);
    expect(service.getServices()[0].id).toBe("cart-service");
  });

  it("keeps cached services when gateway is unreachable", async () => {
    mockGatewayClient.fetchRoutes.mockResolvedValue([
      {
        route_id: "x",
        uri: "http://x:1",
        predicates: [],
        filters: [],
        order: 0,
      },
    ]);
    mockGatewayClient.parseServices.mockReturnValue([
      {
        id: "x",
        name: "X",
        url: "http://x:1",
        healthPath: "/health",
        routes: [],
      },
    ]);
    mockOpenApiFetcher.fetchOpenApi.mockResolvedValue({
      serviceId: "x",
      sourcePath: "",
      status: "missing",
      pathCount: 0,
      endpoints: [],
    });
    await service.refresh();

    mockGatewayClient.fetchRoutes.mockResolvedValue([]);
    await service.refresh();

    expect(service.getServices()).toHaveLength(1);
  });

  it("keeps the last healthy spec and marks it stale when a service becomes unavailable", async () => {
    const services = [
      {
        id: "product-service",
        name: "Product Service",
        url: "http://product:8082",
        healthPath: "/health",
        routes: ["/products/**"],
      },
    ];
    mockGatewayClient.fetchRoutes.mockResolvedValue([
      {
        route_id: "products",
        uri: "http://product:8082",
        predicates: [],
        filters: [],
        order: 0,
      },
    ]);
    mockGatewayClient.parseServices.mockReturnValue(services);
    mockOpenApiAggregator.merge.mockReturnValue({
      openapi: "3.1.0",
      paths: {},
    });
    mockOpenApiFetcher.fetchOpenApi
      .mockResolvedValueOnce({
        serviceId: "product-service",
        sourcePath: "/api-docs",
        status: "healthy",
        pathCount: 1,
        lastFetchedAt: "2026-07-18T00:00:00.000Z",
        spec: { openapi: "3.0.3", paths: { "/products": {} } },
        endpoints: [],
      })
      .mockResolvedValueOnce({
        serviceId: "product-service",
        sourcePath: "",
        status: "missing",
        pathCount: 0,
        error: "unavailable",
        endpoints: [],
      });

    await service.refresh();
    await service.refresh();

    expect(service.getOpenApiDocument()).toEqual({
      openapi: "3.1.0",
      paths: {},
    });
    expect(service.getOpenApiStatuses()[0]).toEqual(
      expect.objectContaining({
        serviceId: "product-service",
        status: "stale",
        sourcePath: "/api-docs",
      }),
    );
  });
});
