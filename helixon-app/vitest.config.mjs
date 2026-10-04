import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same "@/..." import alias as tsconfig.json's paths, so tests can load
// modules that use it.
export default defineConfig({
  test: {
    // Playwright runs e2e/ (npm run test:e2e).
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // See test/server-only-stub.js.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.js", import.meta.url)),
    },
  },
});
