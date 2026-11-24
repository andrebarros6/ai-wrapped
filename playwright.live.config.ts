import { defineConfig, devices } from "@playwright/test";

// Smoke test against a deployed site:  LIVE_URL=https://www.barrosbuilds.com/wrapped/ npx playwright test -c playwright.live.config.ts
export default defineConfig({
  testDir: "e2e",
  testMatch: ["live.smoke.ts", "_*.smoke.ts"],
  timeout: 120_000,
  reporter: "list",
  use: { baseURL: process.env.LIVE_URL ?? "https://ai-wrapped-tau.vercel.app/wrapped/" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
