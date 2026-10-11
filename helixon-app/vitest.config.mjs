import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same "@/..." import alias as tsconfig.json's paths, so tests can load
// modules that use it.
export default defineConfig({
  test: {
    // Playwright runs e2e/ (npm run test:e2e).
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    // `npm run test:coverage` (CI runs it and posts the summary on the run).
    // Report only: no thresholds, so it shows where tests are thin without
    // blocking a change.
    coverage: {
      provider: "v8",
      include: ["app/**/*.{js,jsx}", "lib/**/*.{js,jsx}", "components/**/*.{js,jsx}"],
      exclude: ["**/*.test.{js,jsx,mjs}", "**/node_modules/**"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // See test/server-only-stub.js.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.js", import.meta.url)),
    },
  },
});
