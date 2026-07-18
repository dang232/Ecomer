import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import {
  DiscoveredEndpoint,
  FetchedOpenApiSpec,
  OpenApiDocument,
} from "./discovery.types.js";

const OPENAPI_PATHS = [
  "/v3/api-docs",
  "/api-docs",
  "/api-docs-json",
  "/api-json",
] as const;
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

@Injectable()
export class OpenApiFetcher {
  private readonly logger = new Logger(OpenApiFetcher.name);
  private readonly timeoutMs = Number.parseInt(
    process.env.OPENAPI_FETCH_TIMEOUT_MS ?? "3000",
    10,
  );

  async fetchSchema(
    serviceUrl: string,
    serviceId: string,
  ): Promise<DiscoveredEndpoint[]> {
    return (await this.fetchOpenApi(serviceUrl, serviceId)).endpoints;
  }

  async fetchOpenApi(
    serviceUrl: string,
    serviceId: string,
  ): Promise<FetchedOpenApiSpec> {
    let sawInvalidDocument = false;
    let lastError = "No OpenAPI endpoint responded";

    for (const sourcePath of OPENAPI_PATHS) {
      try {
        const res = await axios.get(`${serviceUrl}${sourcePath}`, {
          timeout: this.timeoutMs,
        });
        if (!this.isOpenApiDocument(res.data)) {
          sawInvalidDocument = true;
          lastError = `${sourcePath} did not return a valid OpenAPI document`;
          continue;
        }

        const spec = res.data as OpenApiDocument;
        const pathCount = Object.keys(
          spec.paths as Record<string, unknown>,
        ).length;
        return {
          serviceId,
          sourcePath,
          status: "healthy",
          pathCount,
          lastFetchedAt: new Date().toISOString(),
          spec,
          endpoints: this.parseSpec(spec, serviceId),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    this.logger.warn(`Unable to fetch OpenAPI for ${serviceId}: ${lastError}`);
    return {
      serviceId,
      sourcePath: "",
      status: sawInvalidDocument ? "invalid" : "missing",
      pathCount: 0,
      error: lastError,
      endpoints: [],
    };
  }

  private isOpenApiDocument(value: unknown): value is OpenApiDocument {
    if (!value || typeof value !== "object") return false;
    const document = value as Record<string, unknown>;
    return (
      (typeof document.openapi === "string" || document.swagger === "2.0") &&
      !!document.paths &&
      typeof document.paths === "object" &&
      !Array.isArray(document.paths)
    );
  }

  private parseSpec(
    spec: OpenApiDocument,
    serviceId: string,
  ): DiscoveredEndpoint[] {
    const endpoints: DiscoveredEndpoint[] = [];
    const paths = spec.paths as
      Record<string, Record<string, unknown>> | undefined;
    if (!paths) return endpoints;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (
          HTTP_METHODS.has(method) &&
          details &&
          typeof details === "object"
        ) {
          const op = details as Record<string, unknown>;
          endpoints.push({
            id: `${serviceId}:${method.toUpperCase()}:${path}`,
            serviceId,
            method: method.toUpperCase(),
            path,
            summary: (op.summary as string) ?? undefined,
            schema: op.requestBody
              ? (op.requestBody as Record<string, unknown>)
              : undefined,
          });
        }
      }
    }

    return endpoints;
  }
}
