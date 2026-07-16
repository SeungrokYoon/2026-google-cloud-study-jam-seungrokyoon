import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    }
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
