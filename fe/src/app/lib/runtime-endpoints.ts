const env = import.meta.env as Record<string, string | undefined>;
let apiOrigin = (env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

export function configureApiOrigin(value: string): void {
  apiOrigin = value.replace(/\/$/, "");
}

export function getApiOrigin(): string {
  return apiOrigin;
}

export function apiUrl(path: string): string {
  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
