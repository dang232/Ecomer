import { strict as assert } from "node:assert";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8080";
const endpoint = process.env.CACHE_STAMPEDE_URL ?? "/products/00000000-0000-0000-0000-000000000000";
const requests = Number.parseInt(process.env.CACHE_STAMPEDE_REQUESTS ?? "100", 10);

if (!Number.isInteger(requests) || requests < 1 || requests > 1000) {
  throw new Error("CACHE_STAMPEDE_REQUESTS must be between 1 and 1000");
}

const url = new URL(endpoint, baseUrl);
const started = performance.now();
const responses = await Promise.all(Array.from({ length: requests }, () => fetch(url)));
const elapsedMs = Math.round(performance.now() - started);
const statusCounts = Object.groupBy(responses, (response) => String(response.status));
const bodySamples = await Promise.all(responses.slice(0, 3).map((response) => response.text()));

assert.equal(responses.length, requests);
console.log(JSON.stringify({
  probe: "cache-stampede",
  url: url.toString(),
  requests,
  elapsedMs,
  statusCounts: Object.fromEntries(Object.entries(statusCounts).map(([status, values]) => [status, values.length])),
  bodySamples: bodySamples.map((body) => body.slice(0, 120)),
  backendCalls: "not observable without service metrics",
}, null, 2));
