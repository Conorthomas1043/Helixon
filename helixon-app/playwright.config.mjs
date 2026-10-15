import { defineConfig, devices } from "@playwright/test";

// End-to-end checks against the production build (`npm run build` first).
// CI runs them after the build; locally: npm run test:e2e.
const PORT = Number(process.env.E2E_PORT || 3123);
// A second server from the same build with /ui-gallery switched on, for
// e2e/screens.spec.js (the signed-in screens). The first stays as production
// runs, so the smoke tests can check the gallery is a 404 there.
const GALLERY_PORT = PORT + 1;

const SCREENS = /screens\.spec\.js$/;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", testIgnore: SCREENS, use: { ...devices["Desktop Chrome"] } },
    { name: "phone", testIgnore: SCREENS, use: { ...devices["Pixel 7"] } },
    { name: "screens-desktop", testMatch: SCREENS, use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${GALLERY_PORT}` } },
    { name: "screens-phone", testMatch: SCREENS, use: { ...devices["Pixel 7"], baseURL: `http://127.0.0.1:${GALLERY_PORT}` } },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/pricing`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${GALLERY_PORT}`,
      env: { UI_GALLERY: "1" },
      url: `http://127.0.0.1:${GALLERY_PORT}/pricing`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
