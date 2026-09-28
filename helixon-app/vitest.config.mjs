import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same "@/..." import alias as tsconfig.json's paths, so tests can load
// modules that use it.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
