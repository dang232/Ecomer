const baseUrl = process.env.BASE_URL ?? "http://localhost:8080";
const template = process.env.CACHE_NEGATIVE_URL ?? "/products/%s";
const requests = Number.parseInt(process.env.CACHE_NEGATIVE_REQUESTS ?? "100", 10);
const prefix = process.env.CACHE_NEGATIVE_PREFIX ?? "00000000-0000-0000-0000-";

if (!Number.isInteger(requests) || requests < 1 || requests > 1000) {
  throw new Error("CACHE_NEGATIVE_REQUESTS must be between 1 and 1000");
}

const ids = Array.from({ length: requests }, (_, index) => `${prefix}${String(index).padStart(12, "0")}`);
const urls = ids.map((id) => new URL(template.replace("%s", id), baseUrl));
const started = performance.now();
const responses = await Promise.all(urls.map((url) => fetch(url)));
const elapsedMs = Math.round(performance.now() - started);
const statusCounts = Object.groupBy(responses, (response) => String(response.status));

console.log(JSON.stringify({
  probe: "cache-negative-flood",
  requests,
  elapsedMs,
  statusCounts: Object.fromEntries(Object.entries(statusCounts).map(([status, values]) => [status, values.length])),
  boundedKeying: "service contract must cap negative-cache key material",
  negativeTtlSeconds: 30,
  backendCalls: "not observable without service metrics",
}, null, 2));
