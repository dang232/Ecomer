const env = import.meta.env as Record<string, string | undefined>;
const API_VERSION_PREFIX = "/api/v1";
let apiOrigin = normalizeOrigin(env.VITE_API_URL ?? "http://localhost:8080");

export function configureApiOrigin(value: string): void {
  apiOrigin = normalizeOrigin(value);
}

export function getApiOrigin(): string {
  return apiOrigin;
}

export function apiUrl(path: string): string {
  return `${apiOrigin}${API_VERSION_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/(api\/v1|api)\/?$/, "").replace(/\/$/, "");
}
