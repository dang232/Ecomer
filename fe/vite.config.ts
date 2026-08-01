import { readFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type Plugin } from "vite";

function configureDevRuntimeEndpoints(template: Record<string, unknown>, origin: string): void {
  const auth = template.auth;
  const websocket = template.websocket;
  if (
    typeof auth !== "object" ||
    auth === null ||
    Array.isArray(auth) ||
    typeof websocket !== "object" ||
    websocket === null ||
    Array.isArray(websocket)
  ) {
    throw new Error("runtime config must include auth and websocket objects");
  }

  const socketOrigin = origin.replace(/^http/, "ws");
  template.runtimeConfigUri = `${origin}/runtime-config.json`;
  template.webUri = `${origin}/`;
  template.apiUri = `${origin}/api/`;
  Object.assign(auth, {
    callbackUri: `${origin}/auth/callback`,
    logoutUri: `${origin}/`,
  });
  Object.assign(websocket, {
    notificationsUri: `${socketOrigin}/api/ws/notifications`,
    messagingUri: `${socketOrigin}/api/ws/messaging`,
  });
}

function devRuntimeConfigPlugin(): Plugin {
  return {
    name: "dev-runtime-config",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/runtime-config.json", (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
          next();
          return;
        }

        try {
          const template = JSON.parse(
            readFileSync(path.resolve(__dirname, "public/runtime-config.json"), "utf8"),
          ) as Record<string, unknown>;
          const generatedAt = new Date();
          template.generatedAt = generatedAt.toISOString();
          template.expiresAt = new Date(generatedAt.getTime() + 4 * 60 * 1000).toISOString();
          configureDevRuntimeEndpoints(
            template,
            new URL(`http://${request.headers.host ?? "localhost:5173"}`).origin,
          );
          const body = JSON.stringify(template);

          response.statusCode = 200;
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Content-Length", Buffer.byteLength(body));
          response.end(request.method === "HEAD" ? undefined : body);
        } catch (error) {
          next(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
  };
}

const analyzeBuild = (() => {
  const modeIndex = process.argv.indexOf("--mode");
  return modeIndex >= 0 && process.argv[modeIndex + 1] === "analyze";
})();

export default defineConfig({
  plugins: [
    ...(analyzeBuild
      ? [
          visualizer({
            filename: "dist/stats.html",
            open: false,
            gzipSize: true,
          }),
        ]
      : []),
    devRuntimeConfigPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        ws: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],

  build: {
    manifest: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router"],
          "react-query": ["@tanstack/react-query"],
          "ui-vendor": ["lucide-react"],
          "motion-vendor": ["motion"],
          "i18n-vendor": ["i18next", "i18next-browser-languagedetector", "react-i18next"],
          "runtime-vendor": ["zod", "sonner", "socket.io-client", "tailwind-merge"],
        },
      },
    },
  },
});
