import { defineConfig, devices } from "@playwright/test";

// End-to-end checks against the production build (`npm run build` first).
// CI runs them after the build; locally: npm run test:e2e.
const PORT = Number(process.env.E2E_PORT || 3123);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/pricing`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
