import { defineConfig, devices } from "@playwright/test";

// Runs against the real static export (npm run build first), served under /wrapped.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  timeout: 90_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0, // a pass-on-retry is reported as "flaky", not hidden
  reporter: process.env.CI ? "list" : [["list"]],
  use: { baseURL: "http://127.0.0.1:4317/wrapped/" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@heavy/ },
    // Memory-hungry tests (the 1 GB ZIP bomb) run alone afterwards, so they can't starve the others.
    { name: "chromium-heavy", use: { ...devices["Desktop Chrome"] }, grep: /@heavy/, dependencies: ["chromium"] },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:4317/wrapped/",
    reuseExistingServer: !process.env.CI,
  },
});
