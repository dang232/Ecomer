#!/usr/bin/env node
/**
 * local-origin-proxy.mjs
 *
 * Proxies HTTP and WebSocket requests from inside a Linux Playwright container
 * back to the host machine so visual snapshots can be generated on Linux while
 * the actual frontend + gateway run on the host OS.
 *
 * Problem:
 *   Playwright's default `webServer` config boots the vite dev server inside the
 *   Docker/Podman container used by Playwright's Linux test runner. On macOS and
 *   Windows, `host.docker.internal` resolves to the host machine — but inside a
 *   Linux test runner, `host.docker.internal` may not be registered or may point
 *   to the wrong interface.
 *
 * Solution:
 *   This script runs INSIDE the container and:
 *   1. Starts an HTTP server on a known loopback port (default 3333)
 *   2. Forwards all HTTP requests to the host via `host.docker.internal:3000/8080`
 *   3. Proxies WebSocket upgrades to the same host
 *
 * Usage:
 *   node scripts/local-origin-proxy.mjs
 *
 * Environment variables:
 *   PROXY_PORT    — HTTP port to listen on (default 3333)
 *   HOST_FRONTEND — Frontend URL on host (default http://host.docker.internal:3000)
 *   HOST_GATEWAY  — Gateway URL on host (default http://host.docker.internal:8080)
 *
 *   In playwright.config.ts, point `webServer.url` and `use.baseURL` at
 *   `http://localhost:3333` when running on Linux.
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PROXY_PORT = Number(process.env.PROXY_PORT ?? 3333);
const HOST_FRONTEND = process.env.HOST_FRONTEND ?? "http://host.docker.internal:3000";
const HOST_GATEWAY = process.env.HOST_GATEWAY ?? "http://host.docker.internal:8080";

// Choose HTTP agent based on URL scheme
function getAgent(urlStr) {
  return urlStr.startsWith("https") ? https : http;
}

// Forward a single HTTP request to the target host
function forwardRequest(req, res, targetUrl) {
  return new Promise((resolve) => {
    const url = new URL(req.url, targetUrl);
    const agent = getAgent(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers },
    };

    // Remove hop-by-hop headers that node's http module will set itself
    delete options.headers["host"];
    delete options.headers["connection"];

    const proxyReq = agent.request(options, (proxyRes) => {
      // Forward status + headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
      resolve();
    });

    proxyReq.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Proxy error: ${err.message}`);
      } else {
        res.end();
      }
      resolve();
    });

    req.pipe(proxyReq, { end: true });
  });
}

// Handle HTTP upgrade (WebSocket)
function handleUpgrade(req, socket, head, targetUrl) {
  const url = new URL(req.url, targetUrl);
  const agent = getAgent(targetUrl);

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers },
  };
  delete options.headers["host"];
  delete options.headers["connection"];

  const proxyReq = agent.request(options);

  proxyReq.on("error", (err) => {
    socket.end(`HTTP/1.1 502 Proxy Error\r\n\r\n${err.message}`);
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    // 101 Switching Protocols — wire the two sockets together
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );

    proxySocket.pipe(socket, { end: true });
    socket.pipe(proxySocket, { end: true });
  });

  proxyReq.end();
}

// Determine target host from the incoming request path
function resolveTarget(pathname) {
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return HOST_GATEWAY;
  }
  return HOST_FRONTEND;
}

// Main HTTP server
const server = http.createServer(async (req, res) => {
  // Parse URL safely — malformed URLs throw
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, "http://localhost/");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad URL");
    return;
  }

  const target = resolveTarget(parsedUrl.pathname);
  await forwardRequest(req, res, target);
});

server.on("upgrade", (req, socket, head) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, "http://localhost/");
  } catch {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    return;
  }

  const target = resolveTarget(parsedUrl.pathname);
  handleUpgrade(req, socket, head, target);
});

function startServer() {
  server.listen(PROXY_PORT, "127.0.0.1", () => {
    console.log(
      `[local-origin-proxy] listening on http://127.0.0.1:${PROXY_PORT}\n` +
        `  frontend → ${HOST_FRONTEND}\n` +
        `  gateway  → ${HOST_GATEWAY}`,
    );
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[local-origin-proxy] port ${PROXY_PORT} is already in use.\n` +
          `Set PROXY_PORT to a different value.`,
      );
      process.exit(1);
    }
    throw err;
  });

  return server;
}

export function createServer() {
  return startServer();
}

// Auto-start when run as main script
const _autoServer = startServer();

// Graceful shutdown
process.on("SIGTERM", () => _autoServer.close(() => process.exit(0)));
process.on("SIGINT", () => _autoServer.close(() => process.exit(0)));
