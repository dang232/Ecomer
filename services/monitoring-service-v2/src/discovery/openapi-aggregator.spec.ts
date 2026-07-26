import { OpenApiAggregator } from "./openapi-aggregator.js";
import { FetchedOpenApiSpec, OpenApiServiceStatus } from "./discovery.types.js";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

describe("OpenApiAggregator", () => {
  const aggregator = new OpenApiAggregator({
    get: () => "http://localhost:8080",
  } as unknown as ConfigService);

  it("is resolvable by Nest with the configured gateway URL", async () => {
    const module = await Test.createTestingModule({
      providers: [
        OpenApiAggregator,
        {
          provide: ConfigService,
          useValue: { get: () => "http://gateway:8080" },
        },
      ],
    }).compile();

    expect(module.get(OpenApiAggregator)).toBeInstanceOf(OpenApiAggregator);
  });

  const status = (
    serviceId: string,
    overrides: Partial<OpenApiServiceStatus> = {},
  ): OpenApiServiceStatus => ({
    serviceId,
    sourcePath: "/api-docs",
    status: "healthy",
    pathCount: 1,
    lastFetchedAt: "2026-07-18T00:00:00.000Z",
    ...overrides,
  });

  const spec = (
    serviceId: string,
    operationId: string,
    deprecated = false,
    path = "/products",
  ): FetchedOpenApiSpec => ({
    serviceId,
    sourcePath: "/api-docs",
    status: "healthy",
    pathCount: 1,
    lastFetchedAt: "2026-07-18T00:00:00.000Z",
    spec: {
      openapi: "3.0.3",
      info: { title: serviceId, version: "1.0.0" },
      security: [{ bearerAuth: [] }],
      paths: {
        [path]: {
          get: {
            operationId,
            tags: ["catalog"],
            deprecated,
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Product: { type: "object", properties: { id: { type: "string" } } },
          Order: {
            type: "object",
            properties: {
              productId: {
                $ref: "#/components/schemas/Product/properties/id",
              },
            },
          },
        },
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      },
    },
    endpoints: [],
  });

  it("merges services with namespaced refs, operation IDs, tags, and deprecation metadata", () => {
    const document = aggregator.merge(
      [
        spec("product-service", "listProducts"),
        spec("coupon-service", "listCoupons", false, "/coupons"),
      ],
      [
        status("product-service"),
        status("coupon-service", { status: "stale" }),
      ],
      new Set(["coupon-service"]),
    );

    const operation = (document.paths as Record<string, any>)["/products"].get;
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "http://localhost:8080" }]);
    expect(operation.operationId).toBe("product-service__listProducts");
    expect(operation.tags).toEqual([
      "product-service",
      "product-service:catalog",
    ]);
    expect(operation["x-vnshop-service"]).toBe("product-service");
    expect(operation.security).toEqual([{ "product-service__bearerAuth": [] }]);
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/product-service__Product");
    expect(
      (document.components as any).schemas["product-service__Product"],
    ).toBeDefined();
    expect(
      (document.components as any).schemas["product-service__Order"].properties
        .productId.$ref,
    ).toBe("#/components/schemas/product-service__Product/properties/id");
    expect(
      (document.components as any).securitySchemes[
        "product-service__bearerAuth"
      ],
    ).toBeDefined();
    expect(
      (document.paths as Record<string, any>)["/coupons"].get.deprecated,
    ).toBe(true);
    expect((document as any)["x-vnshop-service-status"]).toEqual([
      expect.objectContaining({ serviceId: "coupon-service", status: "stale" }),
      expect.objectContaining({
        serviceId: "product-service",
        status: "healthy",
      }),
    ]);
  });

  it("rejects duplicate service paths instead of silently dropping an operation", () => {
    expect(() =>
      aggregator.merge(
        [
          spec("product-service", "listProducts"),
          spec("other-service", "listOther"),
        ],
        [status("product-service"), status("other-service")],
        new Set(),
      ),
    ).toThrow(/duplicate OpenAPI operation/i);
  });

  it("rejects paths that are not represented by the gateway route predicates", () => {
    expect(() =>
      aggregator.merge(
        [spec("product-service", "adminOperation", false, "/admin/products")],
        [status("product-service")],
        new Set(),
        new Map([
          [
            "product-service",
            {
              id: "product-service",
              name: "Product Service",
              url: "http://product:8082",
              healthPath: "/actuator/health",
              routes: ["/products/**"],
            },
          ],
        ]),
      ),
    ).toThrow(/not reachable through the gateway/i);
  });

  it("ignores readiness and liveness probe paths during route validation", () => {
    const document = aggregator.merge(
      [spec("cart-service", "readiness", false, "/ready")],
      [status("cart-service")],
      new Set(),
      new Map([
        [
          "cart-service",
          {
            id: "cart-service",
            name: "Cart Service",
            url: "http://cart:8084",
            healthPath: "/ready",
            routes: ["/cart/**"],
          },
        ],
      ]),
    );

    expect(document.paths).not.toHaveProperty("/ready");
  });
});
