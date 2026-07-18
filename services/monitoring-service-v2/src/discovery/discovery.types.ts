export interface GatewayRoute {
  route_id: string;
  predicates: Array<{ name: string; args: Record<string, string> }>;
  filters: unknown[];
  uri: string;
  order: number;
}

export interface DiscoveredService {
  id: string;
  name: string;
  url: string;
  healthPath: string;
  routes: string[];
}

export interface DiscoveredEndpoint {
  id: string;
  serviceId: string;
  method: string;
  path: string;
  summary?: string;
  schema?: Record<string, unknown>;
}

export type OpenApiDocument = Record<string, unknown>;

export type OpenApiServiceStatusValue =
  "healthy" | "missing" | "invalid" | "stale";

export interface OpenApiServiceStatus {
  serviceId: string;
  sourcePath: string;
  status: OpenApiServiceStatusValue;
  pathCount: number;
  lastFetchedAt?: string;
  error?: string;
}

export interface FetchedOpenApiSpec extends OpenApiServiceStatus {
  spec?: OpenApiDocument;
  endpoints: DiscoveredEndpoint[];
}
