import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FetchedOpenApiSpec,
  DiscoveredService,
  OpenApiDocument,
  OpenApiServiceStatus,
} from "./discovery.types.js";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);
const COMPONENT_TYPES = new Set([
  "schemas",
  "responses",
  "parameters",
  "examples",
  "requestBodies",
  "headers",
  "securitySchemes",
  "links",
  "callbacks",
  "pathItems",
]);

type JsonObject = Record<string, unknown>;
type DeprecatedServices = ReadonlySet<string> | ReadonlyMap<string, string>;

@Injectable()
export class OpenApiAggregator {
  constructor(private readonly config: ConfigService) {}

  merge(
    specs: FetchedOpenApiSpec[],
    statuses: OpenApiServiceStatus[],
    deprecatedServices: DeprecatedServices,
    services: ReadonlyMap<string, DiscoveredService> = new Map(),
  ): OpenApiDocument {
    const paths: JsonObject = {};
    const components: JsonObject = {};
    const tags = specs
      .map((service) => service.serviceId)
      .sort()
      .map((serviceId) => ({
        name: serviceId,
        description: `${serviceId} HTTP API`,
      }));

    for (const service of [...specs].sort((left, right) =>
      left.serviceId.localeCompare(right.serviceId),
    )) {
      if (!service.spec) continue;
      this.validateGatewayPaths(service, services.get(service.serviceId));
      this.mergeComponents(
        components,
        service.serviceId,
        service.spec["components"],
      );
      this.mergePaths(
        paths,
        service,
        this.deprecationDate(deprecatedServices, service.serviceId),
      );
    }

    return {
      openapi: "3.1.0",
      info: {
        title: "VNShop Backend API",
        version: process.env.OPENAPI_DOCUMENT_VERSION ?? "1.0.0",
      },
      servers: [
        {
          url: this.config.get<string>(
            "app.openapiGatewayServerUrl",
            "http://localhost:8080",
          ),
        },
      ],
      tags,
      paths,
      components,
      "x-vnshop-service-status": [...statuses].sort((left, right) =>
        left.serviceId.localeCompare(right.serviceId),
      ),
    };
  }

  withStatuses(
    document: OpenApiDocument,
    statuses: OpenApiServiceStatus[],
  ): OpenApiDocument {
    return {
      ...document,
      "x-vnshop-service-status": [...statuses].sort((left, right) =>
        left.serviceId.localeCompare(right.serviceId),
      ),
    };
  }

  private mergeComponents(
    target: JsonObject,
    serviceId: string,
    source: unknown,
  ): void {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;

    for (const [componentType, entries] of Object.entries(
      source as JsonObject,
    )) {
      if (
        !COMPONENT_TYPES.has(componentType) ||
        !entries ||
        typeof entries !== "object" ||
        Array.isArray(entries)
      ) {
        continue;
      }

      const targetEntries = (target[componentType] ??= {}) as JsonObject;
      for (const [name, value] of Object.entries(entries as JsonObject)) {
        const namespacedName = `${serviceId}__${name}`;
        if (namespacedName in targetEntries) {
          throw new Error(
            `duplicate OpenAPI component: ${componentType}/${namespacedName}`,
          );
        }
        targetEntries[namespacedName] = this.rewriteReferences(
          value,
          serviceId,
        );
      }
    }
  }

  private mergePaths(
    target: JsonObject,
    service: FetchedOpenApiSpec,
    deprecatedSince?: string,
  ): void {
    const sourcePaths = service.spec?.paths;
    if (
      !sourcePaths ||
      typeof sourcePaths !== "object" ||
      Array.isArray(sourcePaths)
    )
      return;

    for (const [path, rawPathItem] of Object.entries(
      sourcePaths as JsonObject,
    )) {
      if (this.isOperationalPath(path)) continue;
      if (
        !rawPathItem ||
        typeof rawPathItem !== "object" ||
        Array.isArray(rawPathItem)
      )
        continue;
      const pathItem = rawPathItem as JsonObject;
      const defaultSecurity = this.rewriteSecurity(
        service.spec?.security,
        service.serviceId,
      );
      const targetPathItem = (target[path] ??= {}) as JsonObject;
      const servicesForPath = new Set<string>();
      const existingPathService = targetPathItem["x-vnshop-service"];
      if (typeof existingPathService === "string")
        servicesForPath.add(existingPathService);
      if (Array.isArray(existingPathService)) {
        existingPathService
          .filter((value): value is string => typeof value === "string")
          .forEach((value) => servicesForPath.add(value));
      }
      servicesForPath.add(service.serviceId);

      for (const [method, rawOperation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method)) continue;
        if (method in targetPathItem) {
          throw new Error(
            `duplicate OpenAPI operation: ${method.toUpperCase()} ${path}`,
          );
        }
        if (
          !rawOperation ||
          typeof rawOperation !== "object" ||
          Array.isArray(rawOperation)
        )
          continue;

        const operation = this.prepareOperation(
          rawOperation as JsonObject,
          service.serviceId,
          path,
          method,
          deprecatedSince,
          defaultSecurity,
        );
        targetPathItem[method] = operation;
      }

      for (const [key, value] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(key) && !(key in targetPathItem)) {
          targetPathItem[key] = this.rewriteReferences(
            value,
            service.serviceId,
          );
        }
      }

      targetPathItem["x-vnshop-service"] =
        servicesForPath.size === 1
          ? [...servicesForPath][0]
          : [...servicesForPath].sort();
    }
  }

  private prepareOperation(
    source: JsonObject,
    serviceId: string,
    path: string,
    method: string,
    deprecatedSince?: string,
    defaultSecurity?: unknown[],
  ): JsonObject {
    const operation = this.rewriteReferences(source, serviceId) as JsonObject;
    const originalOperationId =
      typeof operation.operationId === "string"
        ? operation.operationId
        : `${method}_${path}`;
    operation.operationId = `${serviceId}__${this.slug(originalOperationId)}`;
    operation.tags = [
      serviceId,
      ...(Array.isArray(operation.tags)
        ? operation.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => `${serviceId}:${tag}`)
        : []),
    ];
    operation["x-vnshop-service"] = serviceId;

    if (deprecatedSince) {
      operation.deprecated = true;
      operation["x-vnshop-deprecated-since"] = deprecatedSince;
    }

    if (!Array.isArray(operation.security) && defaultSecurity)
      operation.security = defaultSecurity;
    else if (Array.isArray(operation.security))
      operation.security = this.rewriteSecurity(operation.security, serviceId);

    return operation;
  }

  private rewriteSecurity(
    security: unknown,
    serviceId: string,
  ): unknown[] | undefined {
    if (!Array.isArray(security)) return undefined;
    return security.map((requirement) => {
      if (
        !requirement ||
        typeof requirement !== "object" ||
        Array.isArray(requirement)
      )
        return requirement;
      return Object.fromEntries(
        Object.entries(requirement as JsonObject).map(([name, scopes]) => [
          `${serviceId}__${name}`,
          scopes,
        ]),
      );
    });
  }

  private rewriteReferences(value: unknown, serviceId: string): unknown {
    if (Array.isArray(value))
      return value.map((entry) => this.rewriteReferences(entry, serviceId));
    if (!value || typeof value !== "object") return value;

    const source = value as JsonObject;
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(source)) {
      if (key === "$ref" && typeof entry === "string") {
        result[key] = this.namespaceReference(entry, serviceId);
      } else {
        result[key] = this.rewriteReferences(entry, serviceId);
      }
    }
    return result;
  }

  private namespaceReference(reference: string, serviceId: string): string {
    const match = reference.match(/^#\/components\/([^/]+)\/([^/]+)(.*)$/);
    if (!match) return reference;
    return `#/components/${match[1]}/${serviceId}__${match[2]}${match[3]}`;
  }

  private deprecationDate(
    deprecatedServices: DeprecatedServices,
    serviceId: string,
  ): string | undefined {
    if (deprecatedServices instanceof Map)
      return deprecatedServices.get(serviceId);
    return deprecatedServices.has(serviceId) ? "unknown" : undefined;
  }

  private validateGatewayPaths(
    spec: FetchedOpenApiSpec,
    service?: DiscoveredService,
  ): void {
    if (
      !service?.routes?.length ||
      !spec.spec?.paths ||
      typeof spec.spec.paths !== "object"
    )
      return;

    for (const path of Object.keys(spec.spec.paths as JsonObject)) {
      if (this.isOperationalPath(path)) continue;
      if (!service.routes.some((route) => this.matchesRoute(path, route))) {
        throw new Error(
          `OpenAPI path is not reachable through the gateway: ${spec.serviceId} ${path}`,
        );
      }
    }
  }

  private isOperationalPath(path: string): boolean {
    return (
      path === "/error" ||
      path === "/health" ||
      path === "/ready" ||
      path === "/live" ||
      path.startsWith("/health/") ||
      path.startsWith("/actuator/") ||
      path.startsWith("/api-docs") ||
      path.startsWith("/v3/api-docs") ||
      path.startsWith("/swagger-ui")
    );
  }

  private matchesRoute(path: string, route: string): boolean {
    const normalizedRoute = route.replace(/\/\*\*?$/, "");
    return path === normalizedRoute || path.startsWith(`${normalizedRoute}/`);
  }

  private slug(value: string): string {
    return (
      value.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") ||
      "operation"
    );
  }
}
