import { defineConfig, devices } from "@playwright/test";

/**
 * Siddes E2E Smoke
 * - Starts Next dev server (reuses existing server if already running).
 * - Uses baseURL http://localhost:3000 by default.
 *
 * NOTE:
 * - Backend must be running (docker compose dev) and reachable by the frontend proxy.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: require.resolve("./tests/e2e/global-setup"),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,

  // Early-stage stability: keep suite sequential locally.
  // (You can bump this later when the suite is rock-solid.)
  workers: process.env.CI ? 2 : 1,
  fullyParallel: false,

  reporter: process.env.CI ? [["list"]] : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/siddes-feed",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
