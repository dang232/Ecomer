import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      // The app's build optimizer writes temporary web bundles that can be
      // removed while Happy DOM workers still reference them on Windows.
      deps: {
        optimizer: {
          web: { enabled: false },
        },
      },
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      setupFiles: ["src/test-setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
      },
    },
  }),
);
