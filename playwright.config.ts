import { defineConfig, devices } from "@playwright/test";

// E2E against the local Supabase stack (`npm run db:start && npm run db:reset` first).
// CI runs the production build; locally an already-running `npm run dev` is reused.
const isCI = !!process.env.CI;
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // TOTP steps are 30 s; a test may wait for a fresh code once.
  timeout: 75_000,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: `${baseURL}/login`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
